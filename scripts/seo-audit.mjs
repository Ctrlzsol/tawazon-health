import fs from 'node:fs';
import path from 'node:path';

const SITE="https://tawazon-health.vercel.app";
const ROOT=path.resolve('dist');
const errors=[];
const canonicalFiles=new Map();

function walk(dir){
  if(!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(function(entry){
    const full=path.join(dir,entry.name);
    if(entry.name.charAt(0)==='.' || entry.name==='node_modules') return [];
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function metaContent(html,name){
  const pattern=new RegExp('<meta[^>]*name=["\\\']'+name+'["\\\'][^>]*content=["\\\']([^"\\\']*)["\\\'][^>]*>','i');
  const match=html.match(pattern);
  return match ? match[1].trim() : '';
}

function canonicalHref(html){
  const match=html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i);
  return match ? match[1].trim() : '';
}

function titleText(html){
  const match=html.match(/<title[^>]*>([\\s\\S]*?)<\\/title>/i);
  return match ? match[1].trim() : '';
}

function noindex(html){
  return /\\bnoindex\\b/i.test(metaContent(html,'robots'));
}

const htmlFiles=walk(ROOT).filter(function(file){ return file.endsWith('.html'); });

for(const file of htmlFiles){
  const html=fs.readFileSync(file,'utf8');
  if(noindex(html)) continue;

  const title=titleText(html);
  const description=metaContent(html,'description');
  const canonical=canonicalHref(html);

  if(!title) errors.push(file+': missing title');
  if(!description) errors.push(file+': missing meta description');
  if(!canonical) errors.push(file+': missing canonical');

  if(canonical){
    let parsed;
    try{ parsed=new URL(canonical); }catch{ parsed=null; }
    if(!parsed){
      errors.push(file+': invalid canonical '+canonical);
    }else if(parsed.origin!==new URL(SITE).origin){
      errors.push(file+': off-domain canonical '+canonical);
    }

    if(canonicalFiles.has(canonical)){
      errors.push('duplicate canonical: '+canonical+' in '+file+' and '+canonicalFiles.get(canonical));
    }else{
      canonicalFiles.set(canonical,file);
    }
  }
}

const sitemapPath=path.join(ROOT,'sitemap.xml');
if(fs.existsSync(sitemapPath)){
  const xml=fs.readFileSync(sitemapPath,'utf8');
  const urls=[];
  const chunks=xml.split('<loc>');
  for(let i=1;i<chunks.length;i++){
    const end=chunks[i].indexOf('</loc>');
    if(end>=0) urls.push(chunks[i].slice(0,end).trim());
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

    if(!canonicalFiles.has(url) && !url.includes('/guides/')){
      errors.push('sitemap URL without local canonical: '+url);
    }
  }
}

const fourOhFour=path.join(ROOT,'404.html');
if(fs.existsSync(fourOhFour) && !noindex(fs.readFileSync(fourOhFour,'utf8'))){
  errors.push('404.html must be noindex');
}

if(errors.length){
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log('SEO audit passed. HTML files: '+htmlFiles.length+', indexable canonical URLs: '+canonicalFiles.size);
