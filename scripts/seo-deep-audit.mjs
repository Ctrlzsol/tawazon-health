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

function walk(dir){
  if(!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
    const full=path.join(dir,e.name);
    if(e.name.startsWith('.')||e.name==='node_modules') return [];
    return e.isDirectory()?walk(full):[full];
  });
}
function tagList(html,name){
  const out=[]; const lower=html.toLowerCase(); const needle='<'+name.toLowerCase(); let p=0;
  while((p=lower.indexOf(needle,p))>=0){const end=html.indexOf('>',p);if(end<0)break;out.push(html.slice(p,end+1));p=end+1;}
  return out;
}
function attr(tag,name){
  let p=tag.toLowerCase().indexOf(name.toLowerCase()+'="');
  if(p>=0){const s=p+name.length+2,e=tag.indexOf('"',s);if(e>=0)return tag.slice(s,e)}
  p=tag.toLowerCase().indexOf(name.toLowerCase()+"='");
  if(p>=0){const s=p+name.length+2,e=tag.indexOf("'",s);if(e>=0)return tag.slice(s,e)}
  return '';
}
function meta(html,name){for(const t of tagList(html,'meta'))if(attr(t,'name').toLowerCase()===name.toLowerCase())return attr(t,'content').trim();return '';}
function canonical(html){for(const t of tagList(html,'link'))if(attr(t,'rel').toLowerCase().split(/\s+/).includes('canonical'))return attr(t,'href').trim();return '';}
function title(html){const m=html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);return m?m[1].trim():'';}
function noindex(html){return /\bnoindex\b/i.test(meta(html,'robots'));}
function routeForFile(file){
 const rel=path.relative(DIST,file).replaceAll(path.sep,'/');
 if(rel==='index.html')return '/';
 if(rel.endsWith('/index.html'))return '/'+rel.slice(0,-'/index.html'.length);
 return '/'+rel;
}
const htmlFiles=walk(DIST).filter(f=>f.endsWith('.html'));
const records=new Map();
for(const file of htmlFiles){
 const rel=path.relative(DIST,file).replaceAll(path.sep,'/');
 if(rel==='404.html'||rel.startsWith('generated-guides/'))continue;
 const html=fs.readFileSync(file,'utf8');
 if(noindex(html))continue;
 const t=title(html),d=meta(html,'description'),c=canonical(html);
 if(!t)errors.push(rel+': missing title');
 if(!d)errors.push(rel+': missing description');
 if(!c)errors.push(rel+': missing canonical');
 if((html.match(/<h1\b/gi)||[]).length!==1)errors.push(rel+': expected exactly one H1');
 if(c){
  try{const u=new URL(c);if(u.origin!==ORIGIN)errors.push(rel+': off-domain canonical '+c);if(u.search||u.hash)errors.push(rel+': canonical has query/hash '+c);}
  catch{errors.push(rel+': invalid canonical '+c)}
  if(canonicals.has(c))errors.push('duplicate canonical '+c+' in '+rel+' and '+canonicals.get(c));else canonicals.set(c,rel);
 }
 if(t){if(titles.has(t))warnings.push('duplicate title '+rel+' and '+titles.get(t));else titles.set(t,rel);}
 records.set(routeForFile(file),{file,canonical:c});
 for(const part of html.split('<script').slice(1)){
  const end=part.indexOf('>'); if(end<0)continue;
  const open=part.slice(0,end+1); if(!/type=["']application\/ld\+json["']/i.test(open))continue;
  const close=part.indexOf('</script>'); if(close<0){errors.push(rel+': unterminated JSON-LD');continue;}
  try{JSON.parse(part.slice(end+1,close));}catch(e){errors.push(rel+': invalid JSON-LD '+e.message);}
 }
}
const sitemapPath=path.join(DIST,'sitemap.xml');
if(!fs.existsSync(sitemapPath))errors.push('dist/sitemap.xml missing');
else{
 const xml=fs.readFileSync(sitemapPath,'utf8');const urls=[];for(const ch of xml.split('<loc>').slice(1)){const e=ch.indexOf('</loc>');if(e>=0)urls.push(ch.slice(0,e).trim())}
 const seen=new Set();
 for(const u of urls){
  if(seen.has(u))errors.push('duplicate sitemap URL '+u);seen.add(u);
  try{const x=new URL(u);if(x.origin!==ORIGIN)errors.push('off-domain sitemap '+u);if(x.search||x.hash)errors.push('sitemap query/hash '+u);const route=x.pathname.replace(/\/+$/,'')||'/';if(records.has(route)&&records.get(route).canonical!==u)errors.push('sitemap/canonical mismatch '+u+' vs '+records.get(route).canonical)}catch{errors.push('invalid sitemap URL '+u)}
 }
}
const f404=path.join(DIST,'404.html');if(fs.existsSync(f404)&&!noindex(fs.readFileSync(f404,'utf8')))errors.push('404.html must be noindex');
const routing=path.resolve('vercel.json');
if(fs.existsSync(routing)){
 try{
  const v=JSON.parse(fs.readFileSync(routing,'utf8'));const redirects=Array.isArray(v.redirects)?v.redirects:[];const exact=new Map();
  for(const r of redirects)if(r.source&&!r.source.includes(':')&&!r.source.includes('*'))exact.set(r.source,r.destination||'');
  for(const [s,d] of exact)if(exact.has(d)&&s!==d)errors.push('redirect chain '+s+' -> '+d+' -> '+exact.get(d));
 }catch(e){errors.push('invalid vercel.json '+e.message)}
}
let links=0;
for(const file of htmlFiles){
 const rel=path.relative(DIST,file).replaceAll(path.sep,'/');if(rel==='404.html')continue;
 const html=fs.readFileSync(file,'utf8');
 for(const m of html.matchAll(/href=["']([^"']+)["']/gi)){
  const h=m[1];if(!h.startsWith('/')||h.startsWith('//'))continue;const clean=h.split('#')[0].split('?')[0];if(!clean||clean.startsWith('/api/'))continue;links++;
  const route=clean!=='/'?clean.replace(/\/+$/,''):'/';
  if(records.has(route))continue;
  if(route==='/feed.xml'||route==='/robots.txt'||route==='/sitemap.xml')continue;
  if(route.startsWith('/tools-')||route.startsWith('/sleep-calculator.html')||route.startsWith('/topic-')||route.startsWith('/article-')){errors.push('unknown internal SEO target '+clean+' from '+rel);}
 }
}
const bytes=htmlFiles.reduce((n,f)=>n+fs.statSync(f).size,0);
console.log(JSON.stringify({files:htmlFiles.length,indexable:records.size,canonicals:canonicals.size,sitemap:fs.existsSync(sitemapPath)?(fs.readFileSync(sitemapPath,'utf8').match(/<loc>/g)||[]).length:0,internalLinks:links,htmlBytes:bytes,errors:errors.length,warnings:warnings.length},null,2));
if(warnings.length)console.log('WARNINGS\n'+warnings.slice(0,80).join('\n'));
if(errors.length){console.error('ERRORS\n'+errors.join('\n'));process.exit(1);}
