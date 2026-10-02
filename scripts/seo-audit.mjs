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
  const m=tag.match(new RegExp(name+"=[\"']([^\"']*)[\"']","i"));
  return m ? m[1] : '';
}

function getMeta(html,name){
  for(const part of html.split('<meta').slice(1)){
    const tag='<meta'+part.split('>')[0]+'>';
    if(attr(tag,'name').toLowerCase()===name.toLowerCase()) return attr(tag,'content').trim();
  }
  return '';
}

function getCanonical(html){
  for(const part of html.split('<link').slice(1)){
    const tag='<link'+part.split('>')[0]+'>';
    if(attr(tag,'rel').toLowerCase().split(/ +/).includes('canonical')) return attr(tag,'href').trim();
  }
  return '';
}

function getTitle(html){
  const start=html.toLowerCase().indexOf('<title');
  if(start<0) return '';
  const openEnd=html.indexOf('>',start);
  const close=html.toLowerCase().indexOf('</title>',openEnd);
  if(openEnd<0||close<0) return '';
  return html.slice(openEnd+1,close).trim();
}

function isNoindex(html){
  return /noindex/i.test(getMeta(html,'robots'));
}

const htmlFiles=walk(ROOT).filter(file=>file.endsWith('.html'));
for(const file of htmlFiles){
  const html=fs.readFileSync(file,'utf8');
  if(isNoindex(html)) continue;
  const title=getTitle(html);
  const description=getMeta(html,'description');
  const canonical=getCanonical(html);
  if(!title) errors.push(file+': missing title');
  if(!description) errors.push(file+': missing meta description');
  if(!canonical) errors.push(file+': missing canonical');

  if(canonical){
    try{
      if(new URL(canonical).origin!==new URL(SITE).origin) errors.push(file+': off-domain canonical '+canonical);
    }catch{
      errors.push(file+': invalid canonical '+canonical);
    }
    if(canonicalMap.has(canonical)) errors.push('duplicate canonical '+canonical+' in '+file+' and '+canonicalMap.get(canonical));
    else canonicalMap.set(canonical,file);

    const relative='/'+path.relative(ROOT,file).replaceAll(path.sep,'/');
    let expected=SITE+'/';
    if(relative!=='/' && relative!=='/index.html'){
      expected=SITE+(relative.endsWith('/index.html') ? relative.slice(0,-'/index.html'.length) : relative);
    }
    if(canonical!==expected) errors.push(file+': canonical mismatch; expected '+expected+' got '+canonical);
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
    if(!canonicalMap.has(url) && !url.includes('/guides/')) errors.push('sitemap URL without matching canonical: '+url);
  }
}

const fourOhFour=path.join(ROOT,'404.html');
if(fs.existsSync(fourOhFour) && !isNoindex(fs.readFileSync(fourOhFour,'utf8'))) errors.push('404.html must be noindex');

if(errors.length){
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('SEO audit passed: '+htmlFiles.length+' HTML files, '+canonicalMap.size+' indexable canonical URLs.');
