import fs from 'node:fs';
import path from 'node:path';

const SITE=process.env.SITE_URL || 'https://tawazon-health.vercel.app';
const ROOT=path.resolve('dist');
const errors=[];
const warnings=[];

function walk(dir){
  if(!fs.existsSync(dir))return [];
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
    const full=path.join(dir,entry.name);
    if(entry.name.startsWith('.')||entry.name==='node_modules')return [];
    return entry.isDirectory()?walk(full):[full];
  });
}
function attr(tag,name){
  const lower=tag.toLowerCase();
  const a=name.toLowerCase()+'="';
  let p=lower.indexOf(a);
  if(p>=0){const s=p+a.length,e=tag.indexOf('"',s);if(e>=0)return tag.slice(s,e);}
  const a2=name.toLowerCase()+"='";
  p=lower.indexOf(a2);
  if(p>=0){const s=p+a2.length,e=tag.indexOf("'",s);if(e>=0)return tag.slice(s,e);}
  return '';
}
function metas(html,name){
  const out=[];
  for(const part of html.split('<meta').slice(1)){
    const tag='<meta'+part.split('>')[0]+'>';
    if(attr(tag,'name').toLowerCase()===name.toLowerCase())out.push(attr(tag,'content').trim());
  }
  return out;
}
function canonical(html){
  for(const part of html.split('<link').slice(1)){
    const tag='<link'+part.split('>')[0]+'>';
    if(attr(tag,'rel').toLowerCase().split(/\s+/).includes('canonical'))return attr(tag,'href').trim();
  }
  return '';
}
function title(html){return html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim()||'';}
function h1Count(html){return (html.match(/<h1(?:\s|>)/gi)||[]).length;}
function noindex(html){return /\bnoindex\b/i.test((metas(html,'robots')[0]||''));}
function bodyText(html){
  return html.replace(/<script[\s\S]*?<\/script>/gi,' ')
    .replace(/<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<[^>]+>/g,' ')
    .replace(/\s+/g,' ').trim();
}
function links(html,pageUrl){
  const out=new Set();
  for(const m of html.matchAll(/href=["']([^"']+)["']/gi)){
    const raw=m[1];
    if(!raw||raw.startsWith('#')||raw.startsWith('mailto:')||raw.startsWith('tel:')||raw.startsWith('javascript:'))continue;
    try{
      const u=new URL(raw,pageUrl);
      if(u.origin!==new URL(SITE).origin)continue;
      u.search='';u.hash='';
      if(/\.(css|js|mjs|json|png|jpe?g|gif|svg|webp|ico|xml|txt|pdf|woff2?|ttf|otf)$/i.test(u.pathname))continue;
      out.add(u.href);
    }catch{}
  }
  return [...out];
}
function relPath(file){return path.relative(ROOT,file).replaceAll(path.sep,'/');}
function contentLike(rel){
  return rel.includes('/study/')||rel.includes('/guides/')||rel.startsWith('article-')||
    rel.startsWith('topic-')||rel.includes('/blog/');
}
function normalize(url){
  const u=new URL(url,SITE);
  u.hash='';u.search='';
  if(u.pathname!=='/'&&u.pathname.endsWith('/'))u.pathname=u.pathname.slice(0,-1);
  return u.href;
}
function routeFileFor(url){
  const u=new URL(url,SITE);
  let p=u.pathname;
  if(p==='/' )return path.join(ROOT,'index.html');
  if(p.endsWith('/'))p=p.slice(0,-1);
  const direct=path.join(ROOT,p.slice(1));
  if(fs.existsSync(direct)&&fs.statSync(direct).isFile())return direct;
  const nested=path.join(ROOT,p.slice(1),'index.html');
  if(fs.existsSync(nested))return nested;
  return null;
}

const files=walk(ROOT).filter(f=>f.endsWith('.html')&&!relPath(f).startsWith('.')&&!relPath(f).endsWith('404.html'));
const indexable=[];
const canonicalToFile=new Map();
const titleMap=new Map();
const pageLinks=new Map();

for(const file of files){
  const html=fs.readFileSync(file,'utf8');
  if(noindex(html))continue;
  const rel=relPath(file);
  const c=canonical(html);
  const t=title(html);
  const d=metas(html,'description')[0]||'';
  const h=h1Count(html);
  const text=bodyText(html);
  if(!c)errors.push(rel+': missing canonical');
  if(!t)errors.push(rel+': missing title');
  if(!d)errors.push(rel+': missing description');
  if(h===0)errors.push(rel+': missing H1');
  if(h>1)warnings.push(rel+': multiple H1 ('+h+')');
  if(c){
    try{
      const norm=normalize(c);
      if(new URL(c).origin!==new URL(SITE).origin)errors.push(rel+': off-domain canonical');
      if(canonicalsToString(c)!==norm){} 
      if(canonicalToFile.has(norm))errors.push('duplicate canonical '+norm+' in '+rel+' and '+canonicalToFile.get(norm));
      else canonicalToFile.set(norm,rel);
    }catch{errors.push(rel+': invalid canonical '+c);}
  }
  if(contentLike(rel)){
    if(text.length<700)warnings.push(rel+': thin content '+text.length+' chars');
    if(titleMap.has(t)&&t)warnings.push('duplicate content title '+t+' in '+rel+' and '+titleMap.get(t));
    else if(t)titleMap.set(t,rel);
  }
  const pageUrl=c||SITE+'/'+rel;
  pageLinks.set(normalize(pageUrl),links(html,pageUrl).map(normalize));
  indexable.push({rel,url:normalize(c||pageUrl),contentLike:contentLike(rel),textLength:text.length});
}
function canonicalsToString(x){return normalize(x);}

const sitemapPath=path.join(ROOT,'sitemap.xml');
const sitemapUrls=[];
if(fs.existsSync(sitemapPath)){
  const xml=fs.readFileSync(sitemapPath,'utf8');
  for(const part of xml.split('<loc>').slice(1)){
    const e=part.indexOf('</loc>');
    if(e>=0)sitemapUrls.push(normalize(part.slice(0,e).trim()));
  }
}
const sitemapSet=new Set(sitemapUrls);

const incoming=new Map();
for(const page of indexable)incoming.set(page.url,0);
for(const [src,targets] of pageLinks){
  for(const target of targets){
    if(incoming.has(target)&&target!==src)incoming.set(target,incoming.get(target)+1);
    if(!incoming.has(target)){
      const file=routeFileFor(target);
      if(!file && target.startsWith(new URL(SITE).origin))errors.push('broken internal target '+target+' from '+src);
    }
  }
}
const orphan=[];
for(const page of indexable){
  if(!page.contentLike)continue;
  if(page.url===normalize(SITE+'/'))continue;
  const count=incoming.get(page.url)||0;
  if(count===0)orphan.push(page.url);
}
if(orphan.length)errors.push('orphan content pages without inbound internal links: '+orphan.slice(0,25).join(', '));

const reverseMissing=[];
for(const u of sitemapUrls){
  if(!canonicalToFile.has(u)&&routeFileFor(u)===null){
    reverseMissing.push(u);
  }
}
if(reverseMissing.length)warnings.push('sitemap URLs not represented by local canonical/file: '+reverseMissing.slice(0,20).join(', '));

const queue=[[normalize(SITE+'/'),0]];
const seen=new Set([normalize(SITE+'/')]);
const maxDepth=5;
while(queue.length){
  const [u,d]=queue.shift();
  for(const target of pageLinks.get(u)||[]){
    if(!seen.has(target)){
      seen.add(target);
      if(d+1<=maxDepth)queue.push([target,d+1]);
    }
  }
}
for(const page of indexable.filter(p=>p.contentLike)){
  if(!seen.has(page.url))warnings.push('content page not reachable from homepage link graph: '+page.url);
}
const result={
  generatedAt:new Date().toISOString(),
  site:SITE,
  indexableHtml:indexable.length,
  contentPages:indexable.filter(x=>x.contentLike).length,
  sitemapUrls:sitemapUrls.length,
  uniqueCanonicals:canonicalToFile.size,
  orphanContentPages:orphan.length,
  graphReachablePages:seen.size,
  errors,
  warnings:warnings.slice(0,100)
};
fs.writeFileSync('seo-content-graph-audit.json',JSON.stringify(result,null,2));
if(errors.length){
  console.error(JSON.stringify(result,null,2));
  process.exit(1);
}
console.log(JSON.stringify(result,null,2));
