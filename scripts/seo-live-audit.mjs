import fs from 'node:fs';
import path from 'node:path';

const SITE=(process.env.SEO_SITE_URL||'').replace(/\/+$/,'');
if(!SITE) throw new Error('SEO_SITE_URL is required');
const MAX_CONCURRENCY=Math.max(1,Math.min(10,Number(process.env.SEO_LIVE_CONCURRENCY||6)));
const MAX_URLS=Math.max(1,Number(process.env.SEO_LIVE_MAX_URLS||500));
const NEGATIVE_PATHS=(process.env.SEO_NEGATIVE_PATHS||'').split(',').map(s=>s.trim()).filter(Boolean);
const EXPECTED_HOST=new URL(SITE).host;

function getMeta(html,name){
  const re=new RegExp('<meta[^>]*name=["\\\\\\']'+name+'["\\\\\\'][^>]*content=["\\\\\\']([^"\\\\\\']*)["\\\\\\']','i');
  const m=html.match(re); return m?m[1].trim():'';
}
function getCanonical(html){
  const m=html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i);
  return m?m[1].trim():'';
}
function getTitle(html){
  const m=html.match(/<title[^>]*>([\s\S]*?)<\/title>/i); return m?m[1].trim():'';
}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

async function fetchUrl(url,opts={}){
  const started=performance.now();
  const res=await fetch(url,{redirect:'manual',headers:{'user-agent':'tawazon-seo-audit/1.0 '+process.version,...(opts.headers||{})}});
  const elapsed=Math.round(performance.now()-started);
  const body=opts.readBody===false?'':await res.text();
  return {res,body,elapsed};
}
async function pool(items,worker,concurrency){
  const out=new Array(items.length);let cursor=0;
  async function runner(){
    while(true){const i=cursor++;if(i>=items.length)return;try{out[i]=await worker(items[i],i)}catch(e){out[i]={error:e.message}}}
  }
  await Promise.all(Array.from({length:Math.min(concurrency,items.length)},runner));
  return out;
}

const sitemapUrl=SITE+'/sitemap.xml';
const map=await fetchUrl(sitemapUrl);
if(map.res.status!==200) throw new Error('sitemap HTTP '+map.res.status);
const sitemapUrls=[];
for(const chunk of map.body.split('<loc>').slice(1)){const e=chunk.indexOf('</loc>');if(e>=0)sitemapUrls.push(chunk.slice(0,e).trim());}
const unique=[...new Set(sitemapUrls)];
const errors=[];
const warnings=[];
if(unique.length!==sitemapUrls.length) errors.push('sitemap contains duplicates');

const targets=unique.slice(0,MAX_URLS);
const results=await pool(targets,async function(url){
  const x=await fetchUrl(url);
  const headers=Object.fromEntries(x.res.headers.entries());
  if(x.res.status>=300&&x.res.status<400)return {url,status:x.res.status,location:headers.location||'',elapsed:x.elapsed,bytes:0,headers,redirect:true};
  const contentType=headers['content-type']||'';
  if(x.res.status!==200)return {url,status:x.res.status,elapsed:x.elapsed,bytes:Buffer.byteLength(x.body),headers,error:'non-200'};
  if(!contentType.includes('text/html'))return {url,status:x.res.status,elapsed:x.elapsed,bytes:Buffer.byteLength(x.body),headers,error:'sitemap target is not HTML'};
  const canonical=getCanonical(x.body);
  const robots=(getMeta(x.body,'robots')+' '+(headers['x-robots-tag']||'')).toLowerCase();
  const title=getTitle(x.body);
  const parsed=new URL(url);
  const sameOrigin=canonical?new URL(canonical,Site).origin===new URL(SITE).origin:false;
  return {url,status:200,elapsed:x.elapsed,bytes:Buffer.byteLength(x.body),headers,title,robots,canonical,sameOrigin};
},MAX_CONCURRENCY);

for(const r of results){
  if(!r)continue;
  if(r.error)errors.push(r.url+': '+r.error);
  if(r.status>=300&&r.status<400)errors.push(r.url+': redirect in sitemap to '+r.location);
  if(r.status!==200)errors.push(r.url+': HTTP '+r.status);
  if(r.status===200){
    if(/\bnoindex\b/i.test(r.robots))errors.push(r.url+': noindex response');
    if(!r.canonical)errors.push(r.url+': missing canonical');
    if(r.canonical){
      try{
        const cu=new URL(r.canonical,new URL(SITE));
        const expected=new URL(r.url);
        if(cu.origin!==expected.origin)errors.push(r.url+': canonical off-origin '+r.canonical);
        if(cu.pathname!==expected.pathname||cu.search!==expected.search||cu.hash!==expected.hash)errors.push(r.url+': canonical does not point to self '+r.canonical);
      }catch{errors.push(r.url+': invalid canonical '+r.canonical)}
    }
    if(!r.title)errors.push(r.url+': missing title');
    if(r.elapsed>1500)warnings.push(r.url+': TTFB+download '+r.elapsed+'ms');
    if(r.bytes>500000)warnings.push(r.url+': HTML '+Math.round(r.bytes/1024)+'KB');
  }
}

for(const p of NEGATIVE_PATHS){
  const u=SITE+(p.startsWith('/')?p:'/'+p);
  const x=await fetchUrl(u,{readBody:false});
  if(x.res.status>=200&&x.res.status<400)errors.push('negative route is not non-200: '+p+' -> '+x.res.status);
}

const rootCheck=await fetchUrl(SITE+'/',{readBody:false});
if(rootCheck.res.status!==200)errors.push('homepage HTTP '+rootCheck.res.status);

console.log(JSON.stringify({
  site:SITE,
  host:EXPECTED_HOST,
  sitemapCount:sitemapUrls.length,
  checked:targets.length,
  errors:errors.length,
  warnings:warnings.length,
  maxTTFBms:Math.max(0,...results.map(r=>r?.elapsed||0)),
  avgMs:results.length?Math.round(results.reduce((a,r)=>a+(r?.elapsed||0),0)/results.length):0
},null,2));
if(warnings.length)console.log('WARNINGS\n'+warnings.slice(0,100).join('\n'));
if(errors.length){console.error('ERRORS\n'+errors.slice(0,200).join('\n'));process.exit(1);}
