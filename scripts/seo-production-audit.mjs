import fs from 'node:fs';
import path from 'node:path';

const SITE=(process.env.SEO_SITE_URL||'https://tawazon-health.vercel.app').replace(/\/+$/,'');
const TIMEOUT_MS=15000;
const CONCURRENCY=6;
const CRITICAL=[];
const WARNINGS=[];
const CRAWLED=new Map();
const INBOUND=new Map();

function tags(html,name){const out=[];const lower=html.toLowerCase();const needle='<'+name.toLowerCase();let p=0;while((p=lower.indexOf(needle,p))>=0){const e=html.indexOf('>',p);if(e<0)break;out.push(html.slice(p,e+1));p=e+1;}return out;}
function attr(tag,name){const q=name+'="';const l=tag.toLowerCase();const p=l.indexOf(q.toLowerCase());if(p<0)return '';const s=p+q.length;const e=tag.indexOf('"',s);return e>=0?tag.slice(s,e):'';}
function meta(html,name){for(const t of tags(html,'meta'))if(attr(t,'name').toLowerCase()===name.toLowerCase())return attr(t,'content').trim();return '';}
function canonical(html){for(const t of tags(html,'link'))if(attr(t,'rel').toLowerCase().split(/\s+/).includes('canonical'))return attr(t,'href').trim();return '';}
function title(html){return html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim()||'';}
function h1(html){return (html.match(/<h1(?:\s|>)/gi)||[]).length;}
function noindex(html,headers){return /noindex/i.test(meta(html,'robots'))||/noindex/i.test(headers||'');}
function internalLinks(html){const out=[];const origin=new URL(SITE).origin;for(const m of html.matchAll(/href=["']([^"']+)["']/gi)){const href=m[1].trim();if(!href||href.startsWith('#')||href.startsWith('mailto:')||href.startsWith('tel:'))continue;try{const u=new URL(href,SITE);if(u.origin===origin){u.hash='';out.push(u.href);}}catch{}}return out;}
async function get(url){const c=new AbortController();const timer=setTimeout(()=>c.abort(),TIMEOUT_MS);const started=Date.now();try{const response=await fetch(url,{redirect:'manual',signal:c.signal,headers:{'user-agent':'Tawazon-SEO-Production-Audit/1.0'}});const body=await response.text();return {response,body,elapsed:Date.now()-started};}finally{clearTimeout(timer);}}

async function main(){
 const sm=await get(SITE+'/sitemap.xml');
 if(sm.response.status!==200)CRITICAL.push('Sitemap status '+sm.response.status);
 const sitemap=[...sm.body.split('<loc>').slice(1)].map(x=>x.split('</loc>')[0].trim()).filter(Boolean);
 const seen=new Set();
 for(const url of sitemap){
  if(seen.has(url))CRITICAL.push('Duplicate sitemap URL '+url);seen.add(url);
  try{const u=new URL(url);if(u.origin!==new URL(SITE).origin)CRITICAL.push('Off-domain sitemap URL '+url);if(u.protocol!=='https:')CRITICAL.push('Non-HTTPS sitemap URL '+url);if(u.search||u.hash)CRITICAL.push('Query/hash sitemap URL '+url);}catch{CRITICAL.push('Invalid sitemap URL '+url);}
 }
 async function crawl(url){
  if(CRAWLED.has(url))return CRAWLED.get(url);
  let x;try{x=await get(url);}catch(e){CRITICAL.push('Fetch failed '+url+' '+e);return null;}
  const headers=Object.fromEntries(x.response.headers.entries());
  const item={status:x.response.status,body:x.body,headers,elapsed:x.elapsed};CRAWLED.set(url,item);
  if(x.response.status>=300&&x.response.status<400)CRITICAL.push('Redirected target '+url+' -> '+(headers.location||''));
  if(x.response.status!==200)return item;
  if(noindex(x.body,headers['x-robots-tag']))CRITICAL.push('Noindex sitemap URL '+url);
  const c=canonical(x.body);
  if(!c)CRITICAL.push('Missing canonical '+url);
  else if(new URL(c,url).href!==new URL(url).href)CRITICAL.push('Canonical mismatch '+url+' -> '+new URL(c,url).href);
  if(!title(x.body))CRITICAL.push('Missing title '+url);
  if(!meta(x.body,'description'))CRITICAL.push('Missing description '+url);
  if(h1(x.body)!==1)WARNINGS.push('H1 count '+h1(x.body)+' '+url);
  if(!/<html[^>]+lang=["']ar["']/i.test(x.body))WARNINGS.push('Missing lang=ar '+url);
  if(!/<html[^>]+dir=["']rtl["']/i.test(x.body))WARNINGS.push('Missing dir=rtl '+url);
  for(const l of internalLinks(x.body))INBOUND.set(l,(INBOUND.get(l)||0)+1);
  if(x.elapsed>2000)WARNINGS.push('Slow response '+x.elapsed+'ms '+url);
  if(Buffer.byteLength(x.body,'utf8')>500000)WARNINGS.push('Large HTML '+url);
  for(const m of x.body.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{JSON.parse(m[1]);}catch(e){CRITICAL.push('Invalid JSON-LD '+url+': '+e.message);}}
  return item;
 }
 for(let i=0;i<sitemap.length;i+=CONCURRENCY)await Promise.all(sitemap.slice(i,i+CONCURRENCY).map(crawl));
 const links=new Set();for(const item of CRAWLED.values())for(const l of internalLinks(item.body||''))if(links.size<2000)links.add(l);
 for(const url of links){if(CRAWLED.has(url))continue;const item=await crawl(url);if(item&&[404,410].includes(item.status))CRITICAL.push('Broken internal link '+url);if(item&&item.status>=500)CRITICAL.push('Server error internal link '+url);}
 for(const url of sitemap)if(url!==SITE+'/'&&url!==SITE&&!INBOUND.has(new URL(url).href))WARNINGS.push('Potential orphan '+url);
 const rb=await get(SITE+'/robots.txt');if(rb.response.status!==200)CRITICAL.push('robots.txt status '+rb.response.status);else{if(/^\s*Disallow:\s*\/\s*$/mi.test(rb.body))CRITICAL.push('robots blocks entire site');const expected='Sitemap: '+SITE+'/sitemap.xml';if(!rb.body.split(/\r?\n/).some(line=>line.trim()===expected))WARNINGS.push('robots sitemap directive differs from '+expected);}
 for(const probe of [SITE+'/__seo-404-probe__',SITE+'/this-url-does-not-exist__']){const r=await get(probe);if(![404,410].includes(r.response.status))CRITICAL.push('Unknown URL not 404/410 '+probe+' -> '+r.response.status);}
 console.log(JSON.stringify({site:SITE,sitemapUrls:sitemap.length,crawledPages:CRAWLED.size,internalLinksChecked:links.size,critical:CRITICAL,warnings:WARNINGS},null,2));
 if(CRITICAL.length)process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exit(1);});
