import fs from 'node:fs';
import path from 'node:path';

const SITE="https://tawazon-health.vercel.app";
const ROOT=path.resolve('dist');
const errors=[];
const canonicals=new Map();

function walk(dir){
  if(!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
    const full=path.join(dir,entry.name);
    if(entry.name.startsWith('.')||entry.name==='node_modules') return [];
    return entry.isDirectory()?walk(full):[full];
  });
}
function getMeta(html,name){
  const tag=html.match(new RegExp('<meta[^>]+name=["']'+name+'["'][^>]*content=["']([^"']*)["'][^>]*>','i'));
  return tag?.[1]?.trim()||'';
}
function getCanonical(html){
  return (html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)||[])[1]?.trim()||'';
}

const htmlFiles=walk(ROOT).filter(file=>file.endsWith('.html'));
for(const file of htmlFiles){
  const html=fs.readFileSync(file,'utf8');
  const noindex=/<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html);
  const titleMatch=html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title=titleMatch?.[1]?.trim()||'';
  const description=getMeta(html,'description');
  const canonical=getCanonical(html);

  if(noindex) continue;

  if(!title) errors.push(file+': missing title');
  if(!description) errors.push(file+': missing meta description');
  if(!canonical) errors.push(file+': missing canonical');

  if(canonical){
    try{
      const expectedOrigin=new URL(SITE).origin;
      const parsed=new URL(canonical);
      if(parsed.origin!==expectedOrigin) errors.push(file+': off-domain canonical '+canonical);
    }catch{
      errors.push(file+': invalid canonical '+canonical);
    }
    if(canonicals.has(canonical)) errors.push('duplicate canonical '+canonical+' in '+file+' and '+canonicals.get(canonical));
    else canonicals.set(canonical,file);

    const relative='/'+path.relative(ROOT,file).replaceAll(path.sep,'/');
    const expected=relative==='/'||relative==='/index.html'?SITE+'/':SITE+relative.replace(/\/index\.html$/,'');
    if(canonical!==expected) errors.push(file+': canonical mismatch; expected '+expected+' got '+canonical);
  }
}

const sitemapPath=path.join(ROOT,'sitemap.xml');
if(fs.existsSync(sitemapPath)){
  const xml=fs.readFileSync(sitemapPath,'utf8');
  const urls=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1].trim());
  const duplicateSitemap=urls.filter((u,i,a)=>a.indexOf(u)!==i);
  if(duplicateSitemap.length) errors.push('duplicate sitemap URLs: '+[...new Set(duplicateSitemap)].slice(0,5).join(', '));
  for(const url of urls){
    try{
      if(new URL(url).origin!==new URL(SITE).origin) errors.push('off-domain sitemap URL: '+url);
    }catch{
      errors.push('invalid sitemap URL: '+url);
    }
    if(!canonicals.has(url) && !url.includes('/guides/')) errors.push('sitemap URL without matching generated canonical: '+url);
  }
}
const fourOhFour=path.join(ROOT,'404.html');
if(fs.existsSync(fourOhFour)){
  const html=fs.readFileSync(fourOhFour,'utf8');
  if(!/<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html)) errors.push('404.html must be noindex');
}
if(errors.length){
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('SEO audit passed: '+htmlFiles.length+' HTML files, '+canonicals.size+' indexable canonical URLs.');
