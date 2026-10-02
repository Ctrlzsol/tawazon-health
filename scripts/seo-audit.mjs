import fs from 'node:fs';
import path from 'node:path';

const SITE='https://tawazon-health.vercel.app';
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
  const prefixes=[name+'="',name+"='"];
  for(const prefix of prefixes){
    const start=tag.toLowerCase().indexOf(prefix.toLowerCase());
    if(start<0) continue;
    const valueStart=start+prefix.length;
    const quote=prefix.endsWith('"')?'"':"'";
    const end=tag.indexOf(quote,valueStart);
    if(end>=0) return tag.slice(valueStart,end);
  }
  return '';
}

function tags(html,tagName){
  const out=[];
  const lower=html.toLowerCase();
  const needle='<'+tagName.toLowerCase();
  let pos=0;
  while((pos=lower.indexOf(needle,pos))>=0){
    const end=html.indexOf('>',pos);
    if(end<0) break;
    out.push(html.slice(pos,end+1));
    pos=end+1;
  }
  return out;
}

function meta(html,name){
  for(const tag of tags(html,'meta')){
    if(attr(tag,'name').toLowerCase()===name.toLowerCase()) return attr(tag,'content').trim();
  }
  return '';
}

function canonical(html){
  for(const tag of tags(html,'link')){
    if(attr(tag,'rel').toLowerCase().split(/\s+/).includes('canonical')) return attr(tag,'href').trim();
  }
  return '';
}

function title(html){
  const lower=html.toLowerCase();
  const start=lower.indexOf('<title');
  if(start<0) return '';
  const openEnd=html.indexOf('>',start);
  const close=lower.indexOf('</title>',openEnd);
  if(openEnd<0||close<0) return '';
  return html.slice(openEnd+1,close).trim();
}

function noindex(html){
  return meta(html,'robots').toLowerCase().includes('noindex');
}

const files=walk(ROOT).filter(file=>file.endsWith('.html'));
for(const file of files){
  const html=fs.readFileSync(file,'utf8');
  if(noindex(html)) continue;
  if(!title(html)) errors.push(file+': missing title');
  if(!meta(html,'description')) errors.push(file+': missing meta description');
  const c=canonical(html);
  if(!c) errors.push(file+': missing canonical');
  if(c){
    try{
      if(new URL(c).origin!==new URL(SITE).origin) errors.push(file+': off-domain canonical '+c);
    }catch{
      errors.push(file+': invalid canonical '+c);
    }
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
    }catch{
      errors.push('invalid sitemap URL: '+url);
    }
  }
}

const fourOhFour=path.join(ROOT,'404.html');
if(fs.existsSync(fourOhFour) && !noindex(fs.readFileSync(fourOhFour,'utf8'))) errors.push('404.html must be noindex');

if(errors.length){
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log('SEO audit passed: '+files.length+' HTML files, '+canonicals.size+' indexable canonical URLs.');
