import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(x=>x.isDirectory()?(['dist','node_modules','.git'].includes(x.name)?[]:walk(path.join(d,x.name))):[path.join(d,x.name)]);
const html=walk(root).filter(f=>f.endsWith('.html'));
const problems=[];
for(const file of html){
 const text=fs.readFileSync(file,'utf8');
 if(!text.includes('ca-pub-1304668609520202'))problems.push(`${file}: missing publisher`);
 for(const match of text.matchAll(/href="([^"]+)"/g)){
  const href=match[1];
  if(!href.startsWith('/')||href.startsWith('//'))continue;
  const clean=href.split('#')[0]; if(!clean)continue;
  const target=clean==='/'?path.join(root,'index.html'):path.join(root,clean.slice(1));
  if(!fs.existsSync(target))problems.push(`${file}: broken ${href}`);
 }
 for(const match of text.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)){
  try{JSON.parse(match[1])}catch(e){problems.push(`${file}: invalid JSON-LD ${e.message}`)}
 }
}
const sitemap=fs.readFileSync(path.join(root,'sitemap.xml'),'utf8');
const sitemapUrls=(sitemap.match(/<url>/g)||[]).length;
if(sitemapUrls!==html.length)problems.push(`sitemap has ${sitemapUrls} URLs for ${html.length} HTML pages`);
if(problems.length){console.error(problems.join('\n'));process.exit(1)}
console.log(`Validated ${html.length} HTML pages, internal links, JSON-LD, AdSense and sitemap.`);


