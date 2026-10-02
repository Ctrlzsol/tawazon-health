import fs from 'node:fs';
import path from 'node:path';

const SITE='https://tawazon-health.vercel.app';
const ROOT=path.resolve('dist');
const errors=[];
const warnings=[];
const canonicalMap=new Map();

function walk(dir){
  if(!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
    const full=path.join(dir,entry.name);
    if(['.git','node_modules','dist'].includes(entry.name)) return [];
    return entry.isDirectory()?walk(full):[full];
  });
}
function getTags(html,name){
  const out=[];const lower=html.toLowerCase();const needle='<'+name.toLowerCase();let p=0;
  while((p=lower.indexOf(needle,p))>=0){
    const e=html.indexOf('>',p);if(e<0)break;
    out.push(html.slice(p,e+1));p=e+1;
  }
  return out;
}
function attr(tag,name){
  const lower=tag.toLowerCase();const target=name.toLowerCase()+'="';const p=lower.indexOf(target);
  if(p>=0){const s=p+target.length,e=tag.indexOf('"',s);if(e>=0)return tag.slice(s,e);}
  const target2=name.toLowerCase()+"='";const p2=lower.indexOf(target2);
  if(p2>=0){const s=p2+target2.length,e=tag.indexOf("'",s);if(e>=0)return tag.slice(s,e);}
  return '';
}
function metaValue(html,attribute,value){
  for(const t of tags(html,'meta')){
    if(attr(t,attribute).toLowerCase()===value.toLowerCase()) return attr(t,'content').trim();
  }
  return '';
}
function meta(html,name){ return metaValue(html,'name',name); }
function metaProperty(html,property){
  const value=metaValue(html,'property',property);
  return value || metaValue(html,'name',property);
}
function canonical(html){
  for(const t of getTags(html,'link'))if(attr(t,'rel').toLowerCase().split(/\s+/).includes('canonical'))return attr(t,'href').trim();
  return '';
}
function title(html){return html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim()||'';}
function h1Count(html){return (html.match(/<h1(?:\s|>)/gi)||[]).length;}
function noindex(html){return /\bnoindex\b/i.test(meta(html,'robots'));}
function localLinks(html){
  return [...html.matchAll(/href=["']([^"']+)["']/gi)].map(m=>m[1])
    .filter(h=>h.startsWith('/')&&!h.startsWith('//'))
    .map(h=>h.split('#')[0].split('?')[0])
    .filter(Boolean);
}
function targetFor(href){
  if(href==='/'||href==='')return path.join(ROOT,'index.html');
  if(href.startsWith('/guides/'))return null;
  const clean=href.slice(1);
  if(/\.[A-Za-z0-9]{1,8}$/.test(clean))return path.join(ROOT,clean);
  return path.join(ROOT,clean,'index.html');
}
function checkStructuredData(html,rel){
  for(const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
    let data;
    try{data=JSON.parse(m[1]);}catch(e){errors.push(rel+': invalid JSON-LD '+e.message);continue;}
    const nodes=Array.isArray(data)?data:(data&&Array.isArray(data['@graph'])?data['@graph']:[data]);
    for(const node of nodes){
      if(!node||typeof node!=='object')continue;
      const types=Array.isArray(node['@type'])?node['@type']:[node['@type']].filter(Boolean);
      if(types.includes('BreadcrumbList')&&!Array.isArray(node.itemListElement))errors.push(rel+': BreadcrumbList missing itemListElement');
      if(types.includes('Article')&&!node.headline)errors.push(rel+': Article missing headline');
      if(types.includes('Article')&&node.url&&node.url.startsWith('http')&&new URL(node.url).origin!==new URL(SITE).origin)errors.push(rel+': Article URL off-domain');
      if(types.includes('WebSite')&&!node.url)errors.push(rel+': WebSite missing url');
    }
  }
}

const files=walk(ROOT).filter(file=>file.endsWith('.html'));
for(const file of files){
  const rel=path.relative(ROOT,file).replaceAll(path.sep,'/');
  if(rel==='404.html')continue;
  const html=fs.readFileSync(file,'utf8');
  if(noindex(html))continue;

  const t=title(html), d=meta(html,'description'), c=canonical(html), h1=h1Count(html);
  if(!t)errors.push(rel+': missing title');
  if(!d)errors.push(rel+': missing meta description');
  if(!c)errors.push(rel+': missing canonical');
  if(h1<1)errors.push(rel+': missing H1');
  if(h1>1)warnings.push(rel+': multiple H1 ('+h1+')');
  if(!/<html[^>]+lang=["']ar["']/i.test(html))errors.push(rel+': missing lang=ar');
  if(!/<html[^>]+dir=["']rtl["']/i.test(html))errors.push(rel+': missing dir=rtl');

  if(c){
    try{
      const u=new URL(c);
      if(u.origin!==new URL(SITE).origin)errors.push(rel+': off-domain canonical '+c);
      if(u.protocol!=='https:')errors.push(rel+': non-HTTPS canonical '+c);
      if(u.search||u.hash)errors.push(rel+': canonical has query/hash '+c);
    }catch{errors.push(rel+': invalid canonical '+c);}
    if(canonicalMap.has(c))errors.push('duplicate canonical '+c+' in '+rel+' and '+canonicalMap.get(c));
    else canonicalMap.set(c,rel);
    const og=meta(html,'og:url');
    if(og&&og!==c)warnings.push(rel+': og:url differs from canonical');
    if(!meta(html,'og:title'))warnings.push(rel+': missing og:title');
    if(!meta(html,'og:description'))warnings.push(rel+': missing og:description');
  }

  checkStructuredData(html,rel);

  const bytes=Buffer.byteLength(html,'utf8');
  if(bytes>500000)warnings.push(rel+': HTML >500KB');

  for(const href of localLinks(html)){
    const target=targetFor(href);
    if(target&&!fs.existsSync(target)&&!href.startsWith('/api/'))errors.push(rel+': broken internal link '+href);
  }
}

const sitemapPath=path.join(ROOT,'sitemap.xml');
if(fs.existsSync(sitemapPath)){
  const xml=fs.readFileSync(sitemapPath,'utf8');
  const urls=[];
  for(const chunk of xml.split('<loc>').slice(1)){
    const e=chunk.indexOf('</loc>');
    if(e>=0)urls.push(chunk.slice(0,e).trim());
  }
  const seen=new Set();
  for(const u of urls){
    if(seen.has(u))errors.push('duplicate sitemap URL '+u);
    seen.add(u);
    try{
      const x=new URL(u);
      if(x.origin!==new URL(SITE).origin)errors.push('off-domain sitemap URL '+u);
      if(x.protocol!=='https:')errors.push('non-HTTPS sitemap URL '+u);
      if(x.search||x.hash)errors.push('query/hash sitemap URL '+u);
    }catch{errors.push('invalid sitemap URL '+u);}
  }
}

const fourOhFour=path.join(ROOT,'404.html');
if(fs.existsSync(fourOhFour)&&!noindex(fs.readFileSync(fourOhFour,'utf8')))errors.push('404.html must be noindex');

if(errors.length){console.error(errors.join('\n'));process.exit(1);}
console.log(JSON.stringify({site:SITE,publicHtml:files.length,indexableCanonicals:canonicalMap.size,warnings},null,2));
