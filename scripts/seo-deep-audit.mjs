import fs from 'node:fs';
import path from 'node:path';

const SITE=(process.env.SEO_SITE_URL||'').replace(/\/+$/,'');
if(!SITE) throw new Error('SEO_SITE_URL is required');
const ORIGIN=new URL(SITE).origin;
const DIST=path.resolve('dist');
const errors=[];
const warnings=[];
const canonicals=new Map();
const titles=new Map();
const staticRoutes=new Map();
const dynamicPrefixes=String(process.env.SEO_DYNAMIC_PREFIXES||'').split(',').map(s=>s.trim()).filter(Boolean);

function walk(dir){
  if(!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
    const full=path.join(dir,entry.name);
    if(entry.name.startsWith('.')||entry.name==='node_modules') return [];
    return entry.isDirectory()?walk(full):[full];
  });
}
function attrs(tag,name){
  const re1=new RegExp(name+'="([^"]*)"','i');
  const m1=tag.match(re1); if(m1) return m1[1];
  const re2=new RegExp(name+"='([^']*)'",'i');
  const m2=tag.match(re2); return m2?m2[1]:'';
}
function meta(html,name){
  for(const part of html.split('<meta').slice(1)){
    const tag='<meta'+part.split('>')[0]+'>';
    if(attrs(tag,'name').toLowerCase()===name.toLowerCase()) return attrs(tag,'content').trim();
  }
  return '';
}
function canonical(html){
  for(const part of html.split('<link').slice(1)){
    const tag='<link'+part.split('>')[0]+'>';
    if(attrs(tag,'rel').toLowerCase().split(/\s+/).includes('canonical')) return attrs(tag,'href').trim();
  }
  return '';
}
function title(html){
  const m=html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m?m[1].trim():'';
}
function h1Count(html){ return (html.match(/<h1\b/gi)||[]).length; }
function isNoindex(html){ return /\bnoindex\b/i.test(meta(html,'robots')); }
function stripMarkup(html){
  return html
    .replace(/<script[\s\S]*?<\/script>/gi,' ')
    .replace(/<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<[^>]+>/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}
function routeForFile(file){
  const rel=path.relative(DIST,file).replaceAll(path.sep,'/');
  if(rel==='index.html') return '/';
  if(rel.endsWith('/index.html')) return '/'+rel.slice(0,-'/index.html'.length);
  return '/'+rel;
}
function isDynamicAllowed(pathname){
  return dynamicPrefixes.some(prefix=>pathname===prefix||pathname.startsWith(prefix+'/'));
}
function expectedCanonical(file){
  const route=routeForFile(file);
  return SITE+(route==='/'?'/':route);
}

const htmlFiles=walk(DIST).filter(f=>f.endsWith('.html'));
if(!htmlFiles.length) errors.push('No HTML files found under dist/');

for(const file of htmlFiles){
  const rel=path.relative(DIST,file).replaceAll(path.sep,'/');
  if(rel==='404.html') continue;
  if(rel.startsWith('generated-guides/')) continue;
  const html=fs.readFileSync(file,'utf8');
  const noindex=isNoindex(html);
  if(noindex) continue;

  const can=canonical(html);
  const t=title(html);
  const d=meta(html,'description');
  if(!t) errors.push(rel+': missing title');
  if(!d) errors.push(rel+': missing meta description');
  if(!can) errors.push(rel+': missing canonical');
  if(h1Count(html)!==1) errors.push(rel+': expected exactly one H1, found '+h1Count(html));

  const lang=(html.match(/<html[^>]*\blang=["']([^"']+)["']/i)||[])[1]||'';
  const dir=(html.match(/<html[^>]*\bdir=["']([^"']+)["']/i)||[])[1]||'';
  if(lang!=='ar') warnings.push(rel+': html lang is '+(lang||'(missing)'));
  if(dir!=='rtl') warnings.push(rel+': html dir is '+(dir||'(missing)'));

  if(can){
    try{
      const u=new URL(can);
      if(u.origin!==ORIGIN) errors.push(rel+': canonical off-origin '+can);
      if(u.search||u.hash) errors.push(rel+': canonical contains query/hash '+can);
    }catch{ errors.push(rel+': invalid canonical '+can); }

    const exp=expectedCanonical(file);
    if(!isDynamicAllowed(new URL(can).pathname) && can!==exp) errors.push(rel+': canonical mismatch; expected '+exp+' got '+can);
    if(canonicals.has(can)) errors.push('duplicate canonical '+can+' in '+rel+' and '+canonicals.get(can));
    else canonicals.set(can,rel);
  }

  if(t){
    if(titles.has(t)) warnings.push('duplicate title in '+rel+' and '+titles.get(t));
    else titles.set(t,rel);
    if(t.length>70) warnings.push(rel+': title length '+t.length);
  }
  if(d.length>180) warnings.push(rel+': meta description length '+d.length);

  for(const part of html.split('<script').slice(1)){
    const end=part.indexOf('>');
    if(end<0) continue;
    const tag=part.slice(0,end+1);
    if(!/type=["']application\/ld\+json["']/i.test(tag)) continue;
    const close=part.indexOf('</script>');
    if(close<0) { errors.push(rel+': unterminated JSON-LD script'); continue; }
    try{ JSON.parse(part.slice(end+1,close)); }catch(e){ errors.push(rel+': invalid JSON-LD '+e.message); }
  }

  staticRoutes.set(routeForFile(file),{file,can});
}

const sitemapPath=path.join(DIST,'sitemap.xml');
const sitemapUrls=[];
if(fs.existsSync(sitemapPath)){
  const xml=fs.readFileSync(sitemapPath,'utf8');
  for(const chunk of xml.split('<loc>').slice(1)){
    const end=chunk.indexOf('</loc>');
    if(end>=0) sitemapUrls.push(chunk.slice(0,end).trim());
  }
  const seen=new Set();
  for(const url of sitemapUrls){
    if(seen.has(url)) errors.push('duplicate sitemap URL '+url);
    seen.add(url);
    try{
      const u=new URL(url);
      if(u.origin!==ORIGIN) errors.push('off-origin sitemap URL '+url);
      if(u.search||u.hash) errors.push('sitemap URL contains query/hash '+url);
      const route=u.pathname.replace(/\/+$/,'')||'/';
      const record=staticRoutes.get(route);
      if(record && record.can!==url) errors.push('sitemap/canonical mismatch '+url+' vs '+record.can);
      if(record && isNoindex(fs.readFileSync(record.file,'utf8'))) errors.push('noindex URL in sitemap '+url);
      if(!record && !isDynamicAllowed(route)) errors.push('sitemap URL has no generated page or allowed dynamic route '+url);
    }catch{ errors.push('invalid sitemap URL '+url); }
  }
} else {
  errors.push('dist/sitemap.xml missing');
}

const fourOhFour=path.join(DIST,'404.html');
if(fs.existsSync(fourOhFour) && !isNoindex(fs.readFileSync(fourOhFour,'utf8'))) errors.push('404.html must be noindex');

const routingPath=path.resolve('vercel.json');
if(fs.existsSync(routingPath)){
  try{
    const routing=JSON.parse(fs.readFileSync(routingPath,'utf8'));
    const redirects=Array.isArray(routing.redirects)?routing.redirects:[];
    const exact=new Map();
    for(const r of redirects){
      if(r.source && !r.source.includes(':') && !r.source.includes('*')) exact.set(r.source,r.destination||'');
    }
    for(const [source,dest] of exact){
      if(exact.has(dest) && dest!==source) errors.push('redirect chain '+source+' -> '+dest+' -> '+exact.get(dest));
      if(sitemapUrls.includes(SITE+source.replace(/\/$/,''))) errors.push('redirect source is present in sitemap '+source);
    }
    const headers=Array.isArray(routing.headers)?routing.headers:[];
    for(const h of headers){
      const src=String(h.source||'');
      if(/admin|account|login|signup|checkout|payment|reports|documents|activate|create|reset-password|pro|growth-center/i.test(src)){
        const list=Array.isArray(h.headers)?h.headers:[];
        if(!list.some(x=>String(x.key||'').toLowerCase()==='x-robots-tag'&&/noindex/i.test(String(x.value||'')))){
          errors.push('private route lacks X-Robots-Tag noindex: '+src);
        }
      }
    }
  }catch(e){ errors.push('invalid vercel.json: '+e.message); }
}

const allLinks=[];
for(const file of htmlFiles){
  const html=fs.readFileSync(file,'utf8');
  if(path.relative(DIST,file)==='404.html') continue;
  for(const m of html.matchAll(/href=["']([^"']+)["']/gi)){
    const href=m[1];
    if(!href.startsWith('/')||href.startsWith('//')) continue;
    const clean=href.split('#')[0].split('?')[0];
    if(!clean||clean.startsWith('/api/')) continue;
    allLinks.push({file,clean});
  }
}
for(const link of allLinks){
  let target=link.clean;
  if(target!=='/'&&target.endsWith('/')) target=target.slice(0,-1);
  const record=staticRoutes.get(target);
  if(record) continue;
  if(isDynamicAllowed(target)) continue;
  if(target.startsWith('/tools/')||target.startsWith('/blog/')||target.startsWith('/guides/')||target.startsWith('/study/')){
    errors.push('broken/unknown internal SEO link '+link.clean+' from '+path.relative(DIST,link.file));
  }
}

const publicHtml=htmlFiles.filter(f=>path.relative(DIST,f)!=='404.html'&&!path.relative(DIST,f).startsWith('generated-guides/'));
const indexable=publicHtml.filter(f=>!isNoindex(fs.readFileSync(f,'utf8')));
console.log(JSON.stringify({
  files:publicHtml.length,indexable:indexable.length,uniqueCanonicals:canonicals.size,
  sitemap:sitemapUrls.length,errors:errors.length,warnings:warnings.length
},null,2));
if(warnings.length) console.log('WARNINGS\n'+warnings.slice(0,80).join('\n'));
if(errors.length){ console.error('ERRORS\n'+errors.join('\n')); process.exit(1); }
