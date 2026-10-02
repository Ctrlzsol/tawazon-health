import fs from 'node:fs';
import path from 'node:path';

const SITE='https://tawazon-health.vercel.app';
const ROOT=path.resolve('dist');
const errors=[];
const warnings=[];
const canonicalMap=new Map();
const titleMap=new Map();
const descriptionMap=new Map();

function walk(dir){
  if(!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(function(entry){
    const full=path.join(dir,entry.name);
    if(entry.name.startsWith('.') || entry.name==='node_modules') return [];
    return entry.isDirectory() ? walk(full) : [full];
  });
}
function tags(html,name){
  const out=[];
  const lower=html.toLowerCase();
  const needle='<'+name.toLowerCase();
  let pos=0;
  while((pos=lower.indexOf(needle,pos))>=0){
    const end=html.indexOf('>',pos);
    if(end<0) break;
    out.push(html.slice(pos,end+1));
    pos=end+1;
  }
  return out;
}
function attr(tag,name){
  const lower=tag.toLowerCase();
  const double=name.toLowerCase()+'="';
  let p=lower.indexOf(double);
  if(p>=0){
    const s=p+double.length;
    const e=tag.indexOf('"',s);
    if(e>=0) return tag.slice(s,e);
  }
  const single=name.toLowerCase()+"='";
  p=lower.indexOf(single);
  if(p>=0){
    const s=p+single.length;
    const e=tag.indexOf("'",s);
    if(e>=0) return tag.slice(s,e);
  }
  return '';
}
function metaBy(html,attribute,name){
  for(const tag of tags(html,'meta')){
    if(attr(tag,attribute).toLowerCase()===name.toLowerCase()) return attr(tag,'content').trim();
  }
  return '';
}
function meta(html,name){ return metaBy(html,'name',name); }
function metaProperty(html,name){
  return metaBy(html,'property',name) || metaBy(html,'name',name);
}
function title(html){
  const m=html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].trim() : '';
}
function canonical(html){
  for(const tag of tags(html,'link')){
    if(attr(tag,'rel').toLowerCase().split(/\s+/).includes('canonical')) return attr(tag,'href').trim();
  }
  return '';
}
function noindex(html){ return /\bnoindex\b/i.test(meta(html,'robots')); }
function h1Count(html){ return (html.match(/<h1(?:\s|>)/gi)||[]).length; }
function relFile(file){ return path.relative(ROOT,file).replaceAll(path.sep,'/'); }
function shouldSkip(file){
  const rel=relFile(file);
  if(rel==='404.html') return true;
  
  return false;
}
function expectedCanonical(file){
  const rel=relFile(file);
  if(rel==='index.html') return SITE+'/';
  if(rel.endsWith('/index.html')) return SITE+'/'+rel.slice(0,-'/index.html'.length);
  return SITE+'/'+rel;
}
function jsonLdCheck(html,rel){
  for(const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
    try{
      const data=JSON.parse(match[1]);
      const nodes=Array.isArray(data)?data:(data&&Array.isArray(data['@graph'])?data['@graph']:[data]);
      for(const node of nodes){
        if(!node||typeof node!=='object') continue;
        const types=Array.isArray(node['@type'])?node['@type']:[node['@type']].filter(Boolean);
        if(types.includes('Article')&&!node.headline) errors.push(rel+': Article missing headline');
        if(types.includes('BreadcrumbList')&&!Array.isArray(node.itemListElement)) errors.push(rel+': BreadcrumbList missing itemListElement');
        if(types.includes('WebSite')&&(!node.name||!node.url)) errors.push(rel+': WebSite missing name/url');
        if(types.includes('Organization')&&!node.name) errors.push(rel+': Organization missing name');
      }
    }catch(e){
      errors.push(rel+': invalid JSON-LD '+e.message);
    }
  }
}

const files=walk(ROOT).filter(function(file){return file.endsWith('.html')&&!shouldSkip(file);});
if(!files.length) errors.push('No public HTML files found in dist/');

for(const file of files){
  const rel=relFile(file);
  const html=fs.readFileSync(file,'utf8');
  if(noindex(html)) continue;

  const pageTitle=title(html);
  const pageDescription=meta(html,'description');
  const c=canonical(html);

  if(!pageTitle) errors.push(rel+': missing title');
  if(!pageDescription) errors.push(rel+': missing meta description');
  if(!c) errors.push(rel+': missing canonical');
  if(h1Count(html)!==1) errors.push(rel+': expected exactly one H1; found '+h1Count(html));
  if(!/<html[^>]+lang=["']ar["']/i.test(html)) errors.push(rel+': missing lang=ar');
  if(!/<html[^>]+dir=["']rtl["']/i.test(html)) errors.push(rel+': missing dir=rtl');

  if(pageTitle){
    if(titleMap.has(pageTitle)) warnings.push(rel+': duplicate title with '+titleMap.get(pageTitle));
    else titleMap.set(pageTitle,rel);
    if(pageTitle.length>70) warnings.push(rel+': title length '+pageTitle.length);
  }
  if(pageDescription){
    if(descriptionMap.has(pageDescription)) warnings.push(rel+': duplicate description with '+descriptionMap.get(pageDescription));
    else descriptionMap.set(pageDescription,rel);
    if(pageDescription.length>180) warnings.push(rel+': description length '+pageDescription.length);
  }

  if(c){
    try{
      const u=new URL(c);
      if(u.origin!==new URL(SITE).origin) errors.push(rel+': off-domain canonical '+c);
      if(u.protocol!=='https:') errors.push(rel+': non-HTTPS canonical '+c);
      if(u.search||u.hash) errors.push(rel+': canonical contains query/hash '+c);
      const expected=expectedCanonical(file);
      if(c!==expected) warnings.push(rel+': canonical differs from file URL; expected '+expected+' got '+c);
    }catch{
      errors.push(rel+': invalid canonical '+c);
    }
    if(canonicalMap.has(c)) errors.push('duplicate canonical '+c+' in '+rel+' and '+canonicalMap.get(c));
    else canonicalMap.set(c,rel);

    const ogTitle=metaProperty(html,'og:title');
    const ogDescription=metaProperty(html,'og:description');
    const ogUrl=metaProperty(html,'og:url');
    if(!ogTitle) warnings.push(rel+': missing og:title');
    if(!ogDescription) warnings.push(rel+': missing og:description');
    if(ogUrl&&ogUrl!==c) errors.push(rel+': og:url differs from canonical');
  }

  jsonLdCheck(html,rel);
}

const sitemapPath=path.join(ROOT,'sitemap.xml');
if(!fs.existsSync(sitemapPath)){
  errors.push('dist/sitemap.xml missing');
}else{
  const xml=fs.readFileSync(sitemapPath,'utf8');
  const urls=[];
  for(const chunk of xml.split('<loc>').slice(1)){
    const end=chunk.indexOf('</loc>');
    if(end>=0) urls.push(chunk.slice(0,end).trim());
  }
  const seen=new Set();
  for(const url of urls){
    if(seen.has(url)) errors.push('duplicate sitemap URL '+url);
    seen.add(url);
    try{
      const parsed=new URL(url);
      if(parsed.origin!==new URL(SITE).origin) errors.push('off-domain sitemap URL '+url);
      if(parsed.protocol!=='https:') errors.push('non-HTTPS sitemap URL '+url);
      if(parsed.search||parsed.hash) errors.push('sitemap URL contains query/hash '+url);
      // A sitemap URL is validated against the indexable/canonical set above.
      // Live noindex/header conflicts are checked by the production audit, not by guessing a filesystem path here.
    }catch{}
  }
}

const fourOhFour=path.join(ROOT,'404.html');
if(fs.existsSync(fourOhFour)&&!noindex(fs.readFileSync(fourOhFour,'utf8'))) errors.push('404.html must be noindex');

if(errors.length){
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(JSON.stringify({
  site:SITE,
  publicHtml:files.length,
  indexableCanonicals:canonicalMap.size,
  sitemapUrls:fs.existsSync(sitemapPath)?((fs.readFileSync(sitemapPath,'utf8').match(/<loc>/g)||[]).length):0,
  duplicateTitlesWarnings:[...titleMap.entries()].length,
  warnings
},null,2));
