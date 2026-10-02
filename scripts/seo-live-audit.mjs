import fs from 'node:fs';
import path from 'node:path';

const SITE=(process.env.SEO_SITE_URL||'').replace(/\/+$/,'');
if(!SITE) throw new Error('SEO_SITE_URL is required');
const CONCURRENCY=Math.max(1,Math.min(10,Number(process.env.SEO_LIVE_CONCURRENCY||6)));
const MAX_URLS=Math.max(1,Number(process.env.SEO_LIVE_MAX_URLS||500));
const NEGATIVE=(process.env.SEO_NEGATIVE_PATHS||'').split(',').map(s=>s.trim()).filter(Boolean);
const PRIVATE=(process.env.SEO_PRIVATE_PATHS||'').split(',').map(s=>s.trim()).filter(Boolean);

function attr(tag,name){
  let p=tag.toLowerCase().indexOf(name.toLowerCase()+'="');
  if(p>=0){const s=p+name.length+2,e=tag.indexOf('"',s);if(e>=0)return tag.slice(s,e)}
  p=tag.toLowerCase().indexOf(name.toLowerCase()+"='");
  if(p>=0){const s=p+name.length+2,e=tag.indexOf("'",s);if(e>=0)return tag.slice(s,e)}
  return '';
}
function tags(html,name){
  const out=[],needle='<'+name,lower=html.toLowerCase();let p=0;
  while((p=lower.indexOf(needle,p))>=0){const e=html.indexOf('>',p);if(e<0)break;out.push(html.slice(p,e+1));p=e+1;}
  return out;
}
function meta(html,name){
  for(const tag of tags(html,'meta'))if(attr(tag,'name').toLowerCase()===name.toLowerCase())return attr(tag,'content').trim();
  return '';
}
function canonical(html){
  for(const tag of tags(html,'link'))if(attr(tag,'rel').toLowerCase().split(/\s+/).includes('canonical'))return attr(tag,'href').trim();
  return '';
}
function title(html){const m=html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);return m?m[1].trim():'';}

async function request(url,options={}){
  const started=Date.now();
  const res=await fetch(url,{redirect:'manual',headers:{'user-agent':'seo-live-audit/1.0 '+process.version,...(options.headers||{})}});
  const text=options.readBody===false?'':await res.text();
  return {status:res.status,headers:Object.fromEntries(res.headers.entries()),body:text,ms:Date.now()-started};
}
async function pool(items,worker){
  const out=new Array(items.length);let next=0;
  async function runner(){while(true){const i=next++;if(i>=items.length)return;try{out[i]=await worker(items[i])}catch(e){out[i]={error:e.message}}}}
  await Promise.all(Array.from({length:Math.min(CONCURRENCY,items.length)},runner));return out;
}

const errors=[],warnings=[];
const sitemap=await request(SITE+'/sitemap.xml');
if(sitemap.status!==200) throw new Error('Sitemap HTTP '+sitemap.status);
const urls=[];for(const part of sitemap.body.split('<loc>').slice(1)){const e=part.indexOf('</loc>');if(e>=0)urls.push(part.slice(0,e).trim())}
if(new Set(urls).size!==urls.length)errors.push('duplicate URLs in sitemap');
const selected=urls.slice(0,MAX_URLS);
const results=await pool(selected,async url=>{
  const r=await request(url);
  const ct=r.headers['content-type']||'';
  if(r.status>=300&&r.status<400)return {...r,url,redirect:true,location:r.headers.location||''};
  if(r.status!==200)return {...r,url,error:'non-200'};
  if(!ct.includes('text/html'))return {...r,url,error:'non-HTML sitemap target'};
  const c=canonical(r.body);
  return {...r,url,title:title(r.body),description:meta(r.body,'description'),robots:(meta(r.body,'robots')+' '+(r.headers['x-robots-tag']||'')).toLowerCase(),canonical:c};
});
for(const r of results){
  if(!r)continue;
  if(r.error)errors.push(r.url+': '+r.error+' ('+r.status+')');
  if(r.redirect)errors.push(r.url+': sitemap URL redirects to '+r.location);
  if(r.status===200){
    if(/\bnoindex\b/.test(r.robots))errors.push(r.url+': noindex');
    if(!r.title)errors.push(r.url+': missing title');
    if(!r.description)errors.push(r.url+': missing description');
    if(!r.canonical)errors.push(r.url+': missing canonical');
    if(r.canonical){
      try{
        const a=new URL(r.url),b=new URL(r.canonical,a);
        if(b.origin!==a.origin)errors.push(r.url+': canonical off-origin');
        if(b.pathname!==a.pathname||b.search!==a.search||b.hash!==a.hash)errors.push(r.url+': canonical not self');
      }catch{errors.push(r.url+': invalid canonical')}
    }
    if(r.ms>1500)warnings.push(r.url+': response '+r.ms+'ms');
    if(Buffer.byteLength(r.body)>500000)warnings.push(r.url+': HTML '+Math.round(Buffer.byteLength(r.body)/1024)+'KB');
  }
}

const routingFile=path.resolve('vercel.json');
if(fs.existsSync(routingFile)){
  try{
    const routing=JSON.parse(fs.readFileSync(routingFile,'utf8'));
    for(const rule of (Array.isArray(routing.redirects)?routing.redirects:[])){
      const source=String(rule.source||'');
      if(!source||source.includes(':')||source.includes('*'))continue;
      const u=SITE+(source==='/'?'':source);
      const r=await request(u,{readBody:false});
      if(r.status<300||r.status>=400)errors.push('redirect source '+source+' returned '+r.status);
      if(rule.permanent && ![301,308].includes(r.status))errors.push('permanent redirect '+source+' returned '+r.status);
      const expected=String(rule.destination||'');
      if(expected && r.headers.location){
        const actual=new URL(r.headers.location,u).pathname;
        const wanted=new URL(expected.startsWith('http')?expected:SITE+expected,u).pathname;
        if(actual!==wanted)errors.push('redirect destination mismatch '+source+' -> '+actual+' expected '+wanted);
      }
    }
  }catch(e){errors.push('invalid vercel.json: '+e.message)}
}

for(const p of NEGATIVE){
  const r=await request(SITE+(p.startsWith('/')?p:'/'+p),{readBody:false});
  if(r.status<400)errors.push('negative route '+p+' returned '+r.status);
}
for(const p of PRIVATE){
  const r=await request(SITE+(p.startsWith('/')?p:'/'+p),{readBody:false});
  const robots=(r.headers['x-robots-tag']||'').toLowerCase();
  if(!robots.includes('noindex') && r.status===200)warnings.push('private route lacks X-Robots noindex '+p);
}

console.log(JSON.stringify({site:SITE,sitemap:urls.length,checked:selected.length,errors:errors.length,warnings:warnings.length,maxMs:Math.max(0,...results.map(r=>r?.ms||0))},null,2));
if(warnings.length)console.log('WARNINGS\n'+warnings.slice(0,120).join('\n'));
if(errors.length){console.error('ERRORS\n'+errors.slice(0,200).join('\n'));process.exit(1);}
