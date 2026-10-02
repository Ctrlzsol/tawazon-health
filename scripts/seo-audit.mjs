import fs from 'node:fs';
import path from 'node:path';

const SITE = "https://tawazon-health.vercel.app";
const ROOT = path.resolve('dist');
const errors = [];
const canonicalMap = new Map();
const htmlFiles = [];

function walk(dir){
  if(!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
    const full=path.join(dir,entry.name);
    if(entry.name.startsWith('.') || entry.name==='node_modules') return [];
    return entry.isDirectory()?walk(full):[full];
  });
}
function bodyMeta(html, name){
  const m=html.match(new RegExp('<meta[^>]+name=["\\']'+name+'["\\'][^>]*content=["\\']([^"\\']*)["\\']','i'));
  return m?.[1]?.trim() || '';
}
function canonical(html){
  return (html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)||[])[1]?.trim() || '';
}
for(const file of walk(ROOT)){
  if(!file.endsWith('.html')) continue;
  const html=fs.readFileSync(file,'utf8');
  const noindex=/<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html);
  const title=(html.match(/<title[^>]*>([\\s\\S]*?)<\\/title>/i)||[])[1]?.trim() || '';
  const description=bodyMeta(html,'description');
  const can=canonical(html);
  const rel='/'+path.relative(ROOT,file).replaceAll(path.sep,'/').replace(/\/index\.html$/,'/').replace(/^index\.html$/,'');
  const expected=rel==='/'?SITE+'/':SITE+rel.replace(/\/$/,'');
  htmlFiles.push({file,html,noindex,title,description,can,expected});
  if(!noindex){
    if(!title) errors.push(file+': missing title');
    if(!description) errors.push(file+': missing meta description');
    if(!can) errors.push(file+': missing canonical');
    if(can && can!==expected && !(false && can.startsWith(SITE+'/guides/'))) errors.push(file+': canonical mismatch: '+can+' expected '+expected);
    if(can){
      if(canonicalMap.has(can)) errors.push('duplicate canonical: '+can+' in '+file+' and '+canonicalMap.get(can));
      else canonicalMap.set(can,file);
    }
  }
}
const sitemapPath=path.join(ROOT,'sitemap.xml');
if(fs.existsSync(sitemapPath)){
  const xml=fs.readFileSync(sitemapPath,'utf8');
  const urls=[...xml.matchAll(/<loc>([^<]+)<\\/loc>/g)].map(m=>m[1].trim());
  const badOrigin=urls.filter(u=>{try{return new URL(u).origin!==new URL(SITE).origin}catch{return true}});
  const dup=urls.filter((u,i,a)=>a.indexOf(u)!==i);
  if(badOrigin.length) errors.push('sitemap has off-origin URLs: '+badOrigin.slice(0,5).join(', '));
  if(dup.length) errors.push('sitemap has duplicate URLs: '+[...new Set(dup)].slice(0,5).join(', '));
  for(const u of urls){
    if(!canonicalMap.has(u) && !u.includes('/guides/')) errors.push('sitemap URL lacks matching generated canonical: '+u);
  }
}
const notFound=htmlFiles.find(x=>x.file.endsWith('/404.html')||x.file==='dist/404.html');
if(notFound && !notFound.noindex) errors.push('404.html must be noindex');
if(errors.length){
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('SEO audit passed: '+htmlFiles.length+' HTML files, '+canonicalMap.size+' unique indexable canonicals.');
