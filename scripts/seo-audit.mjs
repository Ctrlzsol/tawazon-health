import fs from 'node:fs';
import path from 'node:path';

const SITE = 'https://tawazon-health.vercel.app';
const ROOT = path.resolve('dist');
const errors = [];
const canonicalMap = new Map();

function walk(dir){
  if(!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
    const full=path.join(dir,entry.name);
    if(entry.name.startsWith('.') || entry.name==='node_modules') return [];
    return entry.isDirectory()?walk(full):[full];
  });
}
function meta(html,name){
  const m=html.match(new RegExp('<meta[^>]+name=["\\']'+name+'["\\'][^>]*content=["\\']([^"\\']*)["\\']','i'));
  return m?.[1]?.trim() || '';
}
function canonical(html){
  return (html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)||[])[1]?.trim() || '';
}
const files=walk(ROOT).filter(f=>f.endsWith('.html'));
for(const file of files){
  const html=fs.readFileSync(file,'utf8');
  const noindex=/<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html);
  const title=(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]?.trim()||'';
  const desc=meta(html,'description');
  const can=canonical(html);
  if(!noindex){
    if(!title) errors.push(file+': missing title');
    if(!desc) errors.push(file+': missing description');
    if(!can) errors.push(file+': missing canonical');
    if(can){
      try{if(new URL(can).origin!==new URL(SITE).origin) errors.push(file+': off-domain canonical '+can);}
      catch{errors.push(file+': invalid canonical '+can);}
      if(canonicalMap.has(can)) errors.push('duplicate canonical '+can+' in '+file+' and '+canonicalMap.get(can));
      else canonicalMap.set(can,file);
    }
  }
}
const sitemap=path.join(ROOT,'sitemap.xml');
if(fs.existsSync(sitemap)){
  const xml=fs.readFileSync(sitemap,'utf8');
  const urls=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1].trim());
  const dup=urls.filter((u,i,a)=>a.indexOf(u)!==i);
  const bad=urls.filter(u=>{try{return new URL(u).origin!==new URL(SITE).origin}catch{return true}});
  if(dup.length) errors.push('duplicate sitemap URLs: '+[...new Set(dup)].slice(0,5).join(', '));
  if(bad.length) errors.push('off-domain sitemap URLs: '+bad.slice(0,5).join(', '));
}
const f404=files.find(f=>f.endsWith('/404.html')||f==='dist/404.html');
if(f404 && !/<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(fs.readFileSync(f404,'utf8'))) errors.push('404.html must be noindex');
if(errors.length){console.error(errors.join('\n'));process.exit(1);}
console.log('SEO audit passed: '+files.length+' HTML files, '+canonicalMap.size+' unique indexable canonicals.');
