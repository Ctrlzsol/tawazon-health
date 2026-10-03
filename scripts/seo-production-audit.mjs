import fs from 'node:fs';
import path from 'node:path';

const SITE=(process.env.SEO_SITE_URL||'https://tawazon-health.vercel.app').replace(/\/+$/,'');
const timeout=15000;
const critical=[];
const warnings=[];
const crawled=new Map();
const inbound=new Map();

async function get(url){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeout);
  const started=Date.now();
  try{
    const response=await fetch(url,{redirect:'manual',signal:controller.signal,headers:{'user-agent':'Tawazon-SEO-Audit/1.0'}});
    const body=await response.text();
    return {response,body,elapsed:Date.now()-started};
  }finally{clearTimeout(timer);}
}
function tags(html,name){
  const out=[];const lower=html.toLowerCase();const needle='<'+name.toLowerCase();let i=0;
  while((i=lower.indexOf(needle,i))>=0){const e=html.indexOf('>',i);if(e<0)break;out.push(html.slice(i,e+1));i=e+1;}
  return out;
}
function attr(tag,name){
  const lower=tag.toLowerCase();const q=name.toLowerCase()+'="';const p=lower.indexOf(q);
  if(p<0)return '';const s=p+q.length;const e=tag.indexOf('"',s);return e>=0?tag.slice(s,e):'';
}
function meta(html,name){
  for(const t of tags(html,'meta'))if(attr(t,'name').toLowerCase()===name.toLowerCase())return attr(t,'content').trim();
  return '';
}
function canonical(html){
  for(const t of tags(html,'link'))if(attr(t,'rel').toLowerCase().split(/\s+/).includes('canonical'))return attr(t,'href').trim();
  return '';
}
function title(html){return html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim()||'';}
function noindex(html,headers){return /\bnoindex\b/i.test(meta(html,'robots'))||/\bnoindex\b/i.test(headers||'');}
function internal(html){
  const out=[];const origin=new URL(SITE).origin;
  for(const m of html.matchAll(/href=["']([^"']+)["']/gi)){
    const href=m[1].trim();if(!href||href.startsWith('#')||href.startsWith('mailto:')||href.startsWith('tel:'))continue;
    try{
      const u=new URL(href,SITE);
      if(u.origin!==origin) continue;
      u.hash='';
      const ext=path.posix.extname(u.pathname).toLowerCase();
      if(ext && !['.html','.htm'].includes(ext)) continue;
      if(/^\/(?:api|assets)\//.test(u.pathname)) continue;
      out.push(u.href);
    }catch{}
  }
  return out;
}
function sitemapUrls(xml){
  return [...xml.split('<loc>').slice(1)].map(x=>x.split('</loc>')[0].trim()).filter(Boolean);
}

function validateStructuredData(html,url){
  for(const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
    let data;try{data=JSON.parse(m[1]);}catch{continue;}
    const nodes=Array.isArray(data)?data:(data&&Array.isArray(data['@graph'])?data['@graph']:[data]);
    for(const node of nodes){
      if(!node||typeof node!=='object')continue;
      const types=Array.isArray(node['@type'])?node['@type']:[node['@type']].filter(Boolean);
      if(types.includes('Article')&&!node.headline)critical.push('Article JSON-LD missing headline '+url);
      if(types.includes('BreadcrumbList')&&!Array.isArray(node.itemListElement))critical.push('BreadcrumbList JSON-LD missing itemListElement '+url);
      if(types.includes('WebSite')&&(!node.name||!node.url))critical.push('WebSite JSON-LD missing name/url '+url);
      if(types.includes('WebApplication')&&(!node.name||!node.url))critical.push('WebApplication JSON-LD missing name/url '+url);
    }
  }
}
async function queryVariantProbe(url){
  const clean=url.split('?')[0].split('#')[0];
  try{
    const result=await get(clean+'?utm_source=seo-audit');
    if(result.response.status===200){
      const c=canonical(result.body);
      if(c&&new URL(c,clean).href!==new URL(clean).href)critical.push('Query variant canonical mismatch '+clean+' -> '+c);
    }
  }catch(e){warnings.push('Query variant probe failed '+clean+' '+e);}
}

async function main(){
  const sm=await get(SITE+'/sitemap.xml');
  if(sm.response.status!==200)critical.push('sitemap status '+sm.response.status);
  const urls=sitemapUrls(sm.body);
  const seen=new Set();
  for(const url of urls){
    if(seen.has(url))critical.push('duplicate sitemap '+url);seen.add(url);
    try{
      const u=new URL(url);
      if(u.origin!==new URL(SITE).origin)critical.push('off-origin sitemap '+url);
      if(u.protocol!=='https:')critical.push('non-https sitemap '+url);
      if(u.search||u.hash)critical.push('query/hash sitemap '+url);
    }catch{critical.push('invalid sitemap '+url);}
  }
  async function crawl(url){
    if(crawled.has(url))return crawled.get(url);
    let x;try{x=await get(url);}catch(e){critical.push('fetch failed '+url+' '+e);return null;}
    const headers=Object.fromEntries(x.response.headers.entries());
    const item={status:x.response.status,body:x.body,headers,elapsed:x.elapsed};crawled.set(url,item);
    if(x.response.status>=300&&x.response.status<400)critical.push('redirected sitemap URL '+url+' -> '+(headers.location||'')); 
    if(x.response.status!==200)return item;
    if(noindex(x.body,headers['x-robots-tag']))critical.push('noindex sitemap URL '+url);
    const c=canonical(x.body);
    if(!c)critical.push('missing canonical '+url);
    else if(new URL(c,url).href!==new URL(url).href)critical.push('canonical mismatch '+url+' -> '+new URL(c,url).href);
    if(!title(x.body))critical.push('missing title '+url);
    if(!meta(x.body,'description'))critical.push('missing meta description '+url);
    const hc=(x.body.match(/<h1(?:\s|>)/gi)||[]).length;
    if(hc!==1)warnings.push('H1 count '+hc+' '+url);
    for(const l of internal(x.body))inbound.set(l,(inbound.get(l)||0)+1);
    for(const m of x.body.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{JSON.parse(m[1]);}catch(e){critical.push('invalid JSON-LD '+url+': '+e.message);}}
    if(x.elapsed>2000)warnings.push('slow response '+x.elapsed+'ms '+url);
    return item;
  }
  for(let i=0;i<urls.length;i+=6)await Promise.all(urls.slice(i,i+6).map(crawl));

  const links=new Set();
  for(const item of crawled.values())for(const l of internal(item.body||''))if(links.size<2000)links.add(l);
  for(const url of links){
    if(crawled.has(url))continue;
    const item=await crawl(url);
    if(item&&[404,410].includes(item.status))critical.push('broken internal link '+url);
    if(item&&item.status>=500)critical.push('server error internal link '+url);
  }
  for(const url of urls)if(url!==SITE+'/'&&url!==SITE&&!inbound.has(new URL(url).href))warnings.push('potential orphan '+url);

  const rb=await get(SITE+'/robots.txt');
  if(rb.response.status!==200)critical.push('robots.txt status '+rb.response.status);
  else{
    if(/^\s*Disallow:\s*\/\s*$/mi.test(rb.body))critical.push('robots blocks site');
    const expected='Sitemap: '+SITE+'/sitemap.xml';
    if(!rb.body.split(/\r?\n/).some(line=>line.trim()===expected))warnings.push('robots sitemap differs from '+expected);
  }

  const probes=[SITE+'/__seo-404-probe__',SITE+'/this-url-does-not-exist__'];
  for(const url of probes){
    const r=await get(url);
    if(![404,410].includes(r.response.status))critical.push('unknown route not 404/410 '+url+' -> '+r.response.status);
  }

  const configFile=path.resolve('vercel.json');
  if(fs.existsSync(configFile)){
    try{
      const config=JSON.parse(fs.readFileSync(configFile,'utf8'));
      const rules=Array.isArray(config.redirects)?config.redirects:[];
      const params=pattern=>[...pattern.matchAll(/:([A-Za-z0-9_]+)(?:\\*)?/g)].map(m=>m[1]);
      for(const rule of rules){
        const source=String(rule.source||'');
        const destination=String(rule.destination||'');
        if(!source)continue;
        const sourceParams=params(source);
        const destinationParams=params(destination);
        if(sourceParams.length){
          if(sourceParams.length!==destinationParams.length||sourceParams.some((x,i)=>x!==destinationParams[i])){
            critical.push('redirect parameter mismatch '+source+' -> '+destination);
          }else{
            warnings.push('skipped live probe for parameterized redirect '+source+' -> '+destination);
          }
          continue;
        }
        const target=new URL(source,SITE).href;
        try{
          const result=await get(target);
          const expectedPermanent=rule.permanent!==false;
          const allowed=expectedPermanent?[301,308].includes(result.response.status):[302,307].includes(result.response.status);
          if(!allowed)critical.push('redirect rule '+source+' expected '+(expectedPermanent?'301/308':'302/307')+' got '+result.response.status);
          const location=result.response.headers.get('location');
          if(!location)critical.push('redirect rule '+source+' missing Location');
          else{
            const destinationUrl=new URL(location,target).href;
            const destinationResult=await get(destinationUrl);
            if(destinationResult.response.status>=300&&destinationResult.response.status<400)critical.push('redirect chain '+source+' -> '+location);
            if([404,410].includes(destinationResult.response.status))critical.push('redirect target '+destinationUrl+' is '+destinationResult.response.status);
          }
        }catch(e){warnings.push('redirect probe failed '+source+' '+e);}
      }
    }catch(e){critical.push('invalid vercel.json '+e.message);}
  }


  const httpOrigin='http://'+new URL(SITE).host+'/';
  try{
    const httpResult=await get(httpOrigin);
    if(![301,302,307,308].includes(httpResult.response.status))warnings.push('HTTP origin does not redirect to HTTPS: '+httpResult.response.status);
  }catch(e){warnings.push('HTTP->HTTPS probe failed '+e);}

  const indexProbe=await get(SITE+'/index.html');
  if([301,308].includes(indexProbe.response.status)){
    if(!indexProbe.response.headers.get('location'))warnings.push('/index.html redirects without Location');
  }else if(indexProbe.response.status===200){
    const c=canonical(indexProbe.body);
    if(c!==SITE+'/')critical.push('/index.html remains 200 without canonical root');
  }else warnings.push('/index.html probe returned '+indexProbe.response.status);

  console.log(JSON.stringify({site:SITE,sitemapUrls:urls.length,crawled:crawled.size,critical,warnings},null,2));
  if(critical.length)process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exit(1);});
