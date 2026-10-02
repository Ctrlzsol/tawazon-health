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
function attr(tag,name){
  const m=tag.match(new RegExp(name+'=["\\\']([^"\\\']*)["\\\']','i'));
  return m ? m[1] : '';
}
function meta(html,name){
  for(const part of html.split('<meta').slice(1)){
    const tag='<meta'+part.split('>')[0]+'>';
    if(attr(tag,'name').toLowerCase()===name.toLowerCase()) return attr(tag,'content').trim();
  }
  return '';
}
function canonical(html){
  for(const part of html.split('<link').slice(1)){
    const tag='<link'+part.split('>')[0]+'>';
    if(attr(tag,'rel').toLowerCase().split(/s+/).includes('canonical')) return attr(tag,'href').trim();
  }
  return '';
}
function title(html){
  const m=html.match(/<title[^>]*>([sS]*?)<\/title>/i);
  return m ? m[1].trim() : '';
}
function noindex(html){
  return /noindex/i.test(meta(html,'robots'));
}
const files=walk(ROOT).filter(file=>file.endsWith('.html'));
for(const file of files){
  const html=fs.readFileSync(file,'utf8');
  if(noindex(html)) continue;
  const t=title(html);
  const d=meta(html,'description');
  const c=canonical(html);
  if(!t) errors.push(file+': missing title');
  if(!d) errors.push(file+': missing meta description');
  if(!c) errors.push(file+': missing canonical');
  if(c){
    try{
      if(new URL(c).origin!==new URL(SITE).origin) errors.push(file+': off-domain canonical '+c);
    }catch{errors.push(file+': invalid canonical '+c);}
    if(canonicals.has(c)) errors.push('duplicate canonical: '+c+' in '+file+' and '+canonicals.get(c));
    else canonicals.set(c,file);
  }
}
const sitemapPath=path.join(ROOT,'sitemap.xml');
if(fs.existsSync(sitemapPath)){
  const xml=fs.readFileSync(sitemapPath,'utf8');
  const urls=[];
  for(const chunk of xml.split('<loc>').slice(1)){
    const end=chunk.indexOf('</loc>');
    if(end>=0) urls.push(chunk.slice(0,end).trim());
  }
  const seen=new Set();
  for(const url of urls){
    if(seen.has(url)) errors.push('duplicate sitemap URL: '+url);
    seen.add(url);
    try{
      if(new URL(url).origin!==new URL(SITE).origin) errors.push('off-domain sitemap URL: '+url);
    }catch{errors.push('invalid sitemap URL: '+url);}
  }
}
const notFound=path.join(ROOT,'404.html');
if(fs.existsSync(notFound)&&!noindex(fs.readFileSync(notFound,'utf8'))) errors.push('404.html must be noindex');
if(errors.length){console.error(errors.join('\n'));process.exit(1);}
console.log('SEO audit passed: '+files.length+' HTML files, '+canonicals.size+' indexable canonical URLs.');
