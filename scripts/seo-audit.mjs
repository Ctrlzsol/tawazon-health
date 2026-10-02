import fs from 'node:fs';
import path from 'node:path';

const SITE="https://tawazon-health.vercel.app";
const ROOT=path.resolve('dist');
const errors=[];
const canonicalMap=new Map();

function walk(dir){
  if(!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
    const full=path.join(dir,entry.name);
    if(entry.name.startsWith('.')||entry.name==='node_modules') return [];
    return entry.isDirectory()?walk(full):[full];
  });
}
function attr(tag,name){
  const pattern = new RegExp("\\b"+name+"\\s*=\\s*[\\\"']([^\\\"']*)[\\\"']", "i");
  const m = tag.match(pattern);
  return m?.[1]||'';
}
function getMetaDescription(html){
  for(const match of html.matchAll(/<meta\\b[^>]*>/gi)){
    const tag=match[0];
    if(attr(tag,'name').toLowerCase()==='description') return attr(tag,'content').trim();
  }
  return '';
}
function getCanonical(html){
  for(const match of html.matchAll(/<link\\b[^>]*>/gi)){
    const tag=match[0];
    if(attr(tag,'rel').toLowerCase().split(/\\s+/).includes('canonical')) return attr(tag,'href').trim();
  }
  return '';
}
function isNoindex(html){
  const robots=getMeta(html,'robots');
  return /\\bnoindex\\b/i.test(robots);
}
function getMeta(html,name){
  for(const match of html.matchAll(/<meta\\b[^>]*>/gi)){
    const tag=match[0];
    if(attr(tag,'name').toLowerCase()===name.toLowerCase()) return attr(tag,'content').trim();
  }
  return '';
}

const htmlFiles=walk(ROOT).filter(file=>file.endsWith('.html'));
for(const file of htmlFiles){
  const html=fs.readFileSync(file,'utf8');
  if(isNoindex(html)) continue;
  const title=(html.match(/<title[^>]*>([\\s\\S]*?)<\\/title>/i)||[])[1]?.trim()||'';
  const description=getMetaDescription(html);
  const canonical=getCanonical(html);
  if(!title) errors.push(file+': missing title');
  if(!description) errors.push(file+': missing meta description');
  if(!canonical) errors.push(file+': missing canonical');
  if(canonical){
    try{
      if(new URL(canonical).origin!==new URL(SITE).origin) errors.push(file+': off-domain canonical '+canonical);
    }catch{errors.push(file+': invalid canonical '+canonical);}
    if(canonicalMap.has(canonical)) errors.push('duplicate canonical '+canonical+' in '+file+' and '+canonicalMap.get(canonical));
    else canonicalMap.set(canonical,file);
    const rel='/'+path.relative(ROOT,file).replaceAll(path.sep,'/');
    const expected=rel==='/'||rel==='/index.html'?SITE+'/':SITE+rel.replace(/\\/index\\.html$/,'');
    if(canonical!==expected) errors.push(file+': canonical mismatch; expected '+expected+' got '+canonical);
  }
}
const sitemapPath=path.join(ROOT,'sitemap.xml');
if(fs.existsSync(sitemapPath)){
  const xml=fs.readFileSync(sitemapPath,'utf8');
  const urls=[...xml.matchAll(/<loc>([^<]+)<\\/loc>/g)].map(m=>m[1].trim());
  const seen=new Set();
  for(const url of urls){
    if(seen.has(url)) errors.push('duplicate sitemap URL: '+url);
    seen.add(url);
    try{
      if(new URL(url).origin!==new URL(SITE).origin) errors.push('off-domain sitemap URL: '+url);
    }catch{errors.push('invalid sitemap URL: '+url);}
    if(!canonicalMap.has(url) && !url.includes('/guides/')) errors.push('sitemap URL without matching canonical: '+url);
  }
}
const fourOhFour=path.join(ROOT,'404.html');
if(fs.existsSync(fourOhFour) && !isNoindex(fs.readFileSync(fourOhFour,'utf8'))) errors.push('404.html must be noindex');
if(errors.length){console.error(errors.join('\n'));process.exit(1);}
console.log('SEO audit passed: '+htmlFiles.length+' HTML files, '+canonicalMap.size+' indexable canonical URLs.');
