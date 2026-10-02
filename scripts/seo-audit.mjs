import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve('dist');
const SITE='https://tawazon-health.vercel.app';
const errors=[];
const warnings=[];
const canonicals=new Map();

function walk(dir){
  if(!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
    const full=path.join(dir,entry.name);
    if(entry.name.startsWith('.')||entry.name==='node_modules') return [];
    return entry.isDirectory()?walk(full):[full];
  });
}
function tags(html,name){
  const out=[];const lower=html.toLowerCase();const needle='<'+name.toLowerCase();let p=0;
  while((p=lower.indexOf(needle,p))>=0){const e=html.indexOf('>',p);if(e<0)break;out.push(html.slice(p,e+1));p=e+1;}
  return out;
}
function attr(tag,name){
  const lower=tag.toLowerCase();
  const p=lower.indexOf(name.toLowerCase()+'="');
  if(p<0)return '';
  const s=p+name.length+2;const e=tag.indexOf('"',s);
  return e>=0?tag.slice(s,e):'';
}
function meta(html,name){
  for(const t of tags(html,'meta'))if(attr(t,'name').toLowerCase()===name.toLowerCase())return attr(t,'content').trim();
  return '';
}
function canonical(html){
  for(const t of tags(html,'link'))if(attr(t,'rel').toLowerCase().split(/\s+/).includes('canonical'))return attr(t,'href').trim();
  return '';
}
function title(html){return html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim()||'';}
function h1Count(html){return (html.match(/<h1(?:\s|>)/gi)||[]).length;}
function noindex(html){return /\bnoindex\b/i.test(meta(html,'robots'));}
function localLinks(html){return [...html.matchAll(/href=["']([^"']+)["']/gi)].map(m=>m[1]).filter(h=>h.startsWith('/')&&!h.startsWith('//')).map(h=>h.split('#')[0].split('?')[0]).filter(Boolean);}
function targetFor(href){
  if(href==='/'||href==='')return path.join(ROOT,'index.html');
  if(href.startsWith('/guides/'))return null;
  const clean=href.slice(1);
  if(clean.endsWith('.html'))return path.join(ROOT,clean);
  return path.join(ROOT,clean,'index.html');
}
function jsonLdCheck(html,file){
  for(const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
    try{JSON.parse(m[1]);}catch(e){errors.push(file+': invalid JSON-LD '+e.message);}
  }
}

const files=walk(ROOT).filter(file=>file.endsWith('.html'));
for(const file of files){
  const rel=path.relative(ROOT,file).replaceAll(path.sep,'/');
  if(rel==='404.html'||rel.startsWith('generated-guides/'))continue;
  const html=fs.readFileSync(file,'utf8');
  if(noindex(html))continue;
  if(!title(html))errors.push(rel+': missing title');
  if(!meta(html,'description'))errors.push(rel+': missing description');
  const c=canonical(html);
  if(!c)errors.push(rel+': missing canonical');
  if(h1Count(html)!==1)warnings.push(rel+': H1 count '+h1Count(html));
  if(!/<html[^>]+lang=["']ar["']/i.test(html))warnings.push(rel+': missing lang=ar');
  if(!/<html[^>]+dir=["']rtl["']/i.test(html))warnings.push(rel+': missing dir=rtl');
  if(c){
    try{
      const u=new URL(c);
      if(u.origin!==new URL(SITE).origin)errors.push(rel+': off-domain canonical '+c);
      if(u.protocol!=='https:')errors.push(rel+': non-HTTPS canonical '+c);
      if(u.search||u.hash)errors.push(rel+': canonical contains query/hash '+c);
    }catch{errors.push(rel+': invalid canonical '+c);}
    if(canonicals.has(c))errors.push('duplicate canonical '+c+' in '+rel+' and '+canonicals.get(c));
    else canonicals.set(c,rel);
    const og=meta(html,'og:url');if(og&&og!==c)warnings.push(rel+': og:url differs from canonical');
  }
  jsonLdCheck(html,rel);
  const bytes=Buffer.byteLength(html,'utf8');if(bytes>500000)warnings.push(rel+': HTML >500KB ('+bytes+')');
  for(const href of localLinks(html)){
    const target=targetFor(href);
    if(target&&!fs.existsSync(target)&&!href.startsWith('/api/'))errors.push(rel+': broken internal link '+href);
  }
}

const sitemap=path.join(ROOT,'sitemap.xml');
if(fs.existsSync(sitemap)){
  const xml=fs.readFileSync(sitemap,'utf8');
  const urls=[];
  for(const chunk of xml.split('<loc>').slice(1)){const e=chunk.indexOf('</loc>');if(e>=0)urls.push(chunk.slice(0,e).trim());}
  const seen=new Set();
  for(const u of urls){
    if(seen.has(u))errors.push('duplicate sitemap URL '+u);seen.add(u);
    try{const x=new URL(u);if(x.origin!==new URL(SITE).origin)errors.push('off-domain sitemap URL '+u);if(x.protocol!=='https:')errors.push('non-HTTPS sitemap URL '+u);if(x.search||x.hash)errors.push('query/hash sitemap URL '+u);}
    catch{errors.push('invalid sitemap URL '+u);}
  }
}
const notFound=path.join(ROOT,'404.html');
if(fs.existsSync(notFound)&&!noindex(fs.readFileSync(notFound,'utf8')))errors.push('404.html must be noindex');

if(errors.length){console.error(errors.join('\n'));process.exit(1);}
console.log(JSON.stringify({site:SITE,publicHtml:files.length,indexableCanonicals:canonicals.size,warnings},null,2));
