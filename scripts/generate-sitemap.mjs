import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const SITE=process.env.SITE_URL || 'https://tawazon-health.vercel.app';
const SITE_ORIGIN=new URL(SITE).origin;

function walk(dir){
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
    const full=path.join(dir,entry.name);
    if(['.git','node_modules','dist','public'].includes(entry.name)) return [];
    return entry.isDirectory()?walk(full):[full];
  });
}

const htmlFiles=walk(ROOT).filter(file=>file.endsWith('.html'));
const urls=[];
for(const file of htmlFiles){
  const html=fs.readFileSync(file,'utf8');
  if(/<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html)) continue;
  const match=html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  if(match){
    try { if(new URL(match[1],SITE).origin!==SITE_ORIGIN) continue; } catch { continue; }
    urls.push(match[1]);
    continue;
  }
  const relative=path.relative(ROOT,file).replaceAll(path.sep,'/');
  if(relative==='index.html') urls.push(SITE+'/');
  else urls.push(SITE+'/'+relative);
}

const unique=[...new Set(urls)].sort();
const xml='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
 + unique.map(url=>`  <url><loc>${url}</loc></url>`).join('\n')
 + '\n</urlset>\n';
fs.mkdirSync(path.join(ROOT,'dist'),{recursive:true});
fs.writeFileSync(path.join(ROOT,'sitemap.xml'),xml);
fs.writeFileSync(path.join(ROOT,'dist','sitemap.xml'),xml);
console.log(`Generated sitemap.xml with ${unique.length} indexable URLs.`);
