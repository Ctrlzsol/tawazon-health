import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const publishRoot=path.join(root,'dist');
if(!fs.existsSync(publishRoot))throw new Error('dist/ publish directory is missing. Run npm run build first.');
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(x=>x.isDirectory()?walk(path.join(d,x.name)):[path.join(d,x.name)]);
const html=walk(publishRoot).filter(f=>f.endsWith('.html')&&!f.endsWith(path.join(publishRoot,'404.html')));
const problems=[];
for(const file of html){
 const text=fs.readFileSync(file,'utf8');
 if(!text.includes('ca-pub-1304668609520202'))problems.push(`${file}: missing publisher`);
 for(const match of text.matchAll(/href="([^"]+)"/g)){
  const href=match[1];
  if(!href.startsWith('/')||href.startsWith('//'))continue;
  const clean=href.split('#')[0]; if(!clean)continue;
  const target=clean==='/'?path.join(publishRoot,'index.html'):path.join(publishRoot,clean.slice(1));
  if(!fs.existsSync(target))problems.push(`${file}: broken ${href}`);
 }
 for(const match of text.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)){
  try{JSON.parse(match[1])}catch(e){problems.push(`${file}: invalid JSON-LD ${e.message}`)}
 }
}
const sitemapText=fs.readFileSync(path.join(root,'sitemap.xml'),'utf8');
const sitemapUrls=[];
for(const chunk of sitemapText.split('<loc>').slice(1)){
  const close=chunk.indexOf('</loc>');
  if(close>=0)sitemapUrls.push(chunk.slice(0,close).trim());
}
const indexableCanonicals=new Set();
for(const file of html){
  const text=fs.readFileSync(file,'utf8');
  if(/<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(text))continue;
  const m=text.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  if(m)indexableCanonicals.add(m[1].trim());
}
const duplicateSitemap=sitemapUrls.filter((u,i,a)=>a.indexOf(u)!==i);
if(duplicateSitemap.length)problems.push('duplicate sitemap URLs: '+[...new Set(duplicateSitemap)].slice(0,5).join(', '));
for(const url of sitemapUrls){
  try{
    if(new URL(url).origin!==new URL('https://tawazon-health.vercel.app').origin)problems.push('off-origin sitemap URL: '+url);
  }catch{problems.push('invalid sitemap URL: '+url);}
}
for(const canonical of indexableCanonicals){
  if(!sitemapUrls.includes(canonical))problems.push('indexable canonical missing from sitemap: '+canonical);
}
for(const url of sitemapUrls){
  if(!indexableCanonicals.has(url))problems.push('sitemap URL not backed by indexable canonical: '+url);
}
if(problems.length){console.error(problems.join('\n'));process.exit(1)}
console.log(`Validated ${html.length} HTML pages, internal links, JSON-LD, AdSense and sitemap.`);

