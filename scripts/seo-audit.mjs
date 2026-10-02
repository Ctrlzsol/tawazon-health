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
  const re=new RegExp(name+'=["\\\\\\']([^"\\\\\\']*)["\\\\\\']','i');return re.exec(tag)?.[1]||'';
}
function meta(html,name){
  for(const t of tags(html,'meta'))if(attr(t,'name').toLowerCase()===name.toLowerCase())return attr(t,'content').trim();
  return '';
}
function canonical(html){
  for(const t of tags(html,'link'))if(attr(t,'rel').toLowerCase().split(/\\s+/).includes('canonical'))return attr(t,'href').trim();
  return '';
}
function title(html){return html.match(/<title[^>]*>([\\s\\S]*?)<\\/title>/i)?.[1]?.trim()||'';}
function h1Count(html){return (html.match(/<h1(?:\\s|>)/gi)||[]).length;}
function noindex(html){return /\\bnoindex\\b/i.test(meta(html,'robots'));}
function jsonLd(html){
  for(const m of html.matchAll(/<script[^>]+type=["']application\\/ld\\+json["'][^>]*>([\\s\\S]*?)<\\/script>/gi)){
    try{JSON.parse(m[1]);}catch(e){errors.push('Invalid JSON-LD: '+e.message);}
  }
}
function localLinks(html){
  return [...html.matchAll(/href=["']([^"']+)["']/gi)].map(m=>m[1]).filter(h=>h.startsWith('/')&&!h.startsWith('//')).map(h=>h.split('#')[0].split('?')[0]).filter(Boolean);
}

const files=walk(ROOT).filter(f=>f.endsWith('.html'));
for(const file of files){
  const rel=path.relative(ROOT,file).replaceAll(path.sep,'/');
  if(rel==='404.html'||noindex(fs.readFileSync(file,'utf8')))continue;
  const html=fs.readFileSync(file,'utf8');
  const t=title(html),d=meta(html,'description'),c=canonical(html);
  if(!t)errors.push(rel+': missing title');
  if(!d)errors.push(rel+': missing description');
  if(h1Count(html)!==1)warnings.push(rel+': H1 count '+h1Count(html));
  if(!/<html[^>]+lang=["']ar["']/i.test(html))warnings.push(rel+': missing lang=ar');
  if(!/<html[^>]+dir=["']rtl["']/i.test(html))warnings.push(rel+': missing dir=rtl');
  if(!c)errors.push(rel+': missing canonical');
  else{
    try{if(new URL(c).origin!==new URL(SITE).origin)errors.push(rel+': off-domain canonical '+c);}
    catch{errors.push(rel+': invalid canonical '+c);}
    if(canonicals.has(c))errors.push('duplicate canonical '+c+' in '+rel+' and '+canonicals.get(c));
    else canonicals.set(c,rel);
    const og=meta(html,'og:url');if(og&&og!==c)warnings.push(rel+': og:url differs from canonical');
  }
  jsonLd(html);
}
const sitemap=path.join(ROOT,'sitemap.xml');
if(fs.existsSync(sitemap)){
  const xml=fs.readFileSync(sitemap,'utf8');const urls=[];
  for(const chunk of xml.split('<loc>').slice(1)){const e=chunk.indexOf('</loc>');if(e>=0)urls.push(chunk.slice(0,e).trim());}
  const seen=new Set();
  for(const u of urls){
    if(seen.has(u))errors.push('duplicate sitemap URL '+u);seen.add(u);
    try{const x=new URL(u);if(x.origin!==new URL(SITE).origin)errors.push('off-domain sitemap URL '+u);if(x.protocol!=='https:')errors.push('non-https sitemap URL '+u);if(x.search||x.hash)errors.push('query/hash sitemap URL '+u);}
    catch{errors.push('invalid sitemap URL '+u);}
  }
}
const notFound=path.join(ROOT,'404.html');
if(fs.existsSync(notFound)&&!noindex(fs.readFileSync(notFound,'utf8')))errors.push('404.html must be noindex');

const routing=path.resolve('vercel.json');
if(fs.existsSync(routing)){
  try{
    const cfg=JSON.parse(fs.readFileSync(routing,'utf8'));
    const exact=new Set((cfg.redirects||[]).filter(r=>r.source&&!r.source.includes(':')).map(r=>r.source));
    for(const file of files){
      const rel=path.relative(ROOT,file).replaceAll(path.sep,'/');
      if(rel==='404.html')continue;
      const html=fs.readFileSync(file,'utf8');
      for(const link of localLinks(html))if(exact.has(link))errors.push(rel+': internal link points to redirect '+link);
    }
  }catch(e){errors.push('invalid vercel.json '+e.message);}
}
if(errors.length){console.error(errors.join('\n'));process.exit(1);}
console.log(JSON.stringify({site:SITE,publicHtml:files.length,indexableCanonicals:canonicals.size,warnings},null,2));
