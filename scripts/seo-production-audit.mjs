import fs from 'node:fs';
import path from 'node:path';

const SITE=(process.env.SEO_SITE_URL||'https://tawazon-health.vercel.app').replace(/\/+$/,'');
const TIMEOUT_MS=Number(process.env.SEO_TIMEOUT_MS||15000);
const CONCURRENCY=Math.max(2,Number(process.env.SEO_CONCURRENCY||8));
const MAX_LINKS=Math.max(100,Number(process.env.SEO_MAX_INTERNAL_LINKS||2500));

const critical=[];
const warnings=[];
const crawled=new Map();
const inbound=new Map();

const PRIVATE_PREFIXES=[
  '/admin','/reports','/pro','/growth-center','/account','/login','/signup',
  '/checkout','/payment','/reset-password','/documents','/activate','/create'
];

function addCritical(message){critical.push(message);}
function addWarning(message){warnings.push(message);}

async function fetchUrl(url,options={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
  const started=Date.now();
  try{
    const response=await fetch(url,{
      redirect:'manual',
      signal:controller.signal,
      headers:{'user-agent':'SEO-production-audit/1.0'},
      ...options
    });
    const elapsed=Date.now()-started;
    const body=options.method==='HEAD' ? '' : await response.text();
    return {response,body,elapsed};
  }finally{
    clearTimeout(timer);
  }
}

function isPrivatePath(p){
  return PRIVATE_PREFIXES.some(prefix=>p===prefix||p.startsWith(prefix+'/'));
}

function parseTags(html,tag){
  const lower=html.toLowerCase();
  const needle='<'+tag.toLowerCase();
  const result=[];
  let pos=0;
  while((pos=lower.indexOf(needle,pos))>=0){
    const end=html.indexOf('>',pos);
    if(end<0) break;
    result.push(html.slice(pos,end+1));
    pos=end+1;
  }
  return result;
}

function attr(tag,name){
  const re=new RegExp('(?:^|\\\\s)'+name+'\\\\s*=\\\\s*["\\\\\\']([^"\\\\\\']*)["\\\\\\']','i');
  const m=tag.match(re);
  return m?.[1]||'';
}

function meta(html,name){
  for(const tag of parseTags(html,'meta')){
    if(attr(tag,'name').toLowerCase()===name.toLowerCase()) return attr(tag,'content').trim();
  }
  return '';
}

function canonical(html){
  for(const tag of parseTags(html,'link')){
    if(attr(tag,'rel').toLowerCase().split(/\\s+/).includes('canonical')) return attr(tag,'href').trim();
  }
  return '';
}

function title(html){
  const m=html.match(/<title[^>]*>([\\s\\S]*?)<\\/title>/i);
  return m?.[1]?.trim()||'';
}

function h1Count(html){
  return (html.match(/<h1(?:\\s|>)/gi)||[]).length;
}

function jsonLd(html){
  const blocks=[];
  for(const m of html.matchAll(/<script[^>]+type=["']application\\/ld\\+json["'][^>]*>([\\s\\S]*?)<\\/script>/gi)){
    const raw=m[1].trim();
    try{blocks.push(JSON.parse(raw));}
    catch(error){addCritical('Invalid JSON-LD: '+error.message);}
  }
  return blocks;
}

function absoluteInternalLinks(html){
  const links=[];
  for(const m of html.matchAll(/href=["']([^"']+)["']/gi)){
    const href=m[1].trim();
    if(!href||href.startsWith('#')||href.startsWith('mailto:')||href.startsWith('tel:')||href.startsWith('javascript:')) continue;
    try{
      const u=new URL(href,SITE);
      if(u.origin===new URL(SITE).origin){
        u.hash='';
        links.push(u);
      }
    }catch{}
  }
  return links;
}

function parseSitemap(xml){
  return [...xml.split('<loc>').slice(1)].map(chunk=>{
    const end=chunk.indexOf('</loc>');
    return end>=0?chunk.slice(0,end).trim():'';
  }).filter(Boolean);
}

async function main(){
  const sitemapUrl=SITE+'/sitemap.xml';
  const sitemapResult=await fetchUrl(sitemapUrl);
  const sitemapResponse=sitemapResult.response;
  if(!sitemapResponse||sitemapResponse.status!==200) addCritical('Sitemap HTTP status '+(sitemapResponse?.status||'unknown'));
  const sitemapXml=sitemapResult.body||'';
  if(!/<urlset\\b/i.test(sitemapXml)) addCritical('Sitemap is not a valid urlset document.');
  const sitemapUrls=parseSitemap(sitemapXml);
  if(!sitemapUrls.length) addCritical('Sitemap contains zero URLs.');

  const siteOrigin=new URL(SITE).origin;
  const seen=new Set();

  for(const url of sitemapUrls){
    if(seen.has(url)) addCritical('Duplicate sitemap URL: '+url);
    seen.add(url);
    try{
      const parsed=new URL(url);
      if(parsed.origin!==siteOrigin) addCritical('Off-origin sitemap URL: '+url);
      if(parsed.protocol!=='https:') addCritical('Non-HTTPS sitemap URL: '+url);
      if(parsed.search||parsed.hash) addCritical('Sitemap URL has query/hash: '+url);
    }catch{
      addCritical('Invalid sitemap URL: '+url);
    }
  }

  async function crawl(url){
    if(crawled.has(url)) return crawled.get(url);
    let result;
    try{result=await fetchUrl(url);}
    catch(error){
      const item={url,error:String(error)};
      crawled.set(url,item);
      addCritical('Fetch failed: '+url+' :: '+error);
      return item;
    }

    const {response,body,elapsed}=result;
    const headers=Object.fromEntries(response.headers.entries());
    const item={url,status:response.status,body,elapsed,headers};
    crawled.set(url,item);

    if(response.status>=300&&response.status<400){
      addCritical('Sitemap URL redirects: '+url+' -> '+(headers.location||'unknown'));
      return item;
    }
    if(response.status!==200){
      addCritical('Sitemap URL status '+response.status+': '+url);
      return item;
    }
    if(!/^text\\/html(?:;|$)/i.test(headers['content-type']||'')){
      addWarning('Sitemap URL is not served as HTML: '+url+' ['+(headers['content-type']||'missing')+']');
    }

    const noindex=/(?:^|,|\\s)noindex(?:,|\\s|$)/i.test(meta(body,'robots'))||/noindex/i.test(headers['x-robots-tag']||'');
    const c=canonical(body);
    if(noindex) addCritical('Sitemap URL is noindex: '+url);
    if(!title(body)) addCritical('Missing title: '+url);
    if(!meta(body,'description')) addCritical('Missing meta description: '+url);
    if(h1Count(body)!==1) addWarning('Expected exactly one H1: '+url+' (found '+h1Count(body)+')');
    const canonicalUrl=c?new URL(c,url).href:'';
    if(!c) addCritical('Missing canonical: '+url);
    else if(canonicalUrl!==new URL(url).href) addCritical('Canonical mismatch: '+url+' -> '+canonicalUrl);
    if(/<html[^>]+lang=["']ar["']/i.test(body)===false) addWarning('Missing lang="ar": '+url);
    if(/<html[^>]+dir=["']rtl["']/i.test(body)===false) addWarning('Missing dir="rtl": '+url);

    const ogUrl=meta(body,'og:url');
    if(ogUrl && ogUrl!==new URL(url).href) addWarning('og:url differs from page URL: '+url+' -> '+ogUrl);

    jsonLd(body);

    if(elapsed>2000) addWarning('Slow TTFB/response (>2s): '+url+' ['+elapsed+'ms]');
    const bytes=Buffer.byteLength(body,'utf8');
    if(bytes>500000) addWarning('Large HTML (>500KB): '+url+' ['+bytes+' bytes]');

    for(const link of absoluteInternalLinks(body)){
      const href=link.href;
      if(inbound.has(href)) inbound.set(href,inbound.get(href)+1);
      else inbound.set(href,1);
    }
    return item;
  }

  for(let i=0;i<sitemapUrls.length;i+=CONCURRENCY){
    await Promise.all(sitemapUrls.slice(i,i+CONCURRENCY).map(crawl));
  }

  const internalCandidates=new Set();
  for(const item of crawled.values()){
    if(!item.body) continue;
    for(const link of absoluteInternalLinks(item.body)){
      if(internalCandidates.size>=MAX_LINKS) break;
      internalCandidates.add(link.href);
    }
  }

  for(const href of internalCandidates){
    const parsed=new URL(href);
    if(isPrivatePath(parsed.pathname)) continue;
    if(crawled.has(href)) continue;
    const item=await crawl(href);
    if(item.status>=300&&item.status<400) addCritical('Internal link points to redirect: '+href);
    else if(item.status===404||item.status===410) addCritical('Broken internal link '+item.status+': '+href);
    else if(item.status>=500) addCritical('Internal link server error '+item.status+': '+href);
  }

  for(const url of sitemapUrls){
    if(url===SITE+'/'||url===SITE) continue;
    const count=inbound.get(new URL(url).href)||0;
    if(count===0) addWarning('Potential orphan sitemap URL: '+url);
  }

  const robots=await fetchUrl(SITE+'/robots.txt');
  if(robots.response?.status!==200) addCritical('robots.txt HTTP status '+(robots.response?.status||'unknown'));
  else{
    const rtext=robots.body||'';
    if(/^\\s*User-agent:\\s*\\*\\s*\\n\\s*Disallow:\\s*\\/\\s*$/mi.test(rtext)) addCritical('robots.txt blocks the whole site.');
    const sitemapLine=[...rtext.matchAll(/^\\s*Sitemap:\\s*(\\S+)\\s*$/gmi)].map(m=>m[1]);
    if(!sitemapLine.includes(sitemapUrl)) addCritical('robots.txt does not point to '+sitemapUrl);
  }

  const configFile=path.resolve('vercel.json');
  if(fs.existsSync(configFile)){
    try{
      const config=JSON.parse(fs.readFileSync(configFile,'utf8'));
      for(const rule of (config.redirects||[])){
        const source=String(rule.source||'');
        if(!source) continue;
        let sample=source;
        sample=sample.replace(/:path\\*/g,'seo-probe');
        sample=sample.replace(/:[A-Za-z0-9_]+/g,'seo-sample');
        const target=new URL(sample,SITE).href;
        try{
          const result=await fetchUrl(target);
          const expectedPermanent=rule.permanent!==false;
          const okayStatus=expectedPermanent?[301,308].includes(result.response.status):[302,307].includes(result.response.status);
          if(!okayStatus) addWarning('Redirect rule did not expose expected redirect status: '+source+' -> '+rule.destination+' (got '+result.response.status+')');
          if(!result.response.headers.get('location')) addWarning('Redirect response missing Location: '+source);
        }catch(error){addWarning('Redirect probe failed '+source+': '+error);}
      }
    }catch(error){addCritical('Invalid vercel.json: '+error.message);}
  }

  const probes=[
    SITE+'/__seo-404-probe__',
    SITE+'/this-route-does-not-exist-for-seo-audit__'
  ];
  for(const probe of probes){
    try{
      const result=await fetchUrl(probe);
      if(![404,410].includes(result.response.status)) addCritical('Unknown URL did not return 404/410: '+probe+' -> '+result.response.status);
    }catch(error){addCritical('404 probe failed '+probe+': '+error);}
  }

  console.log(JSON.stringify({
    site:SITE,
    sitemapUrls:sitemapUrls.length,
    crawledPages:crawled.size,
    internalLinksChecked:internalCandidates.size,
    critical,
    warnings
  },null,2));

  if(critical.length) process.exitCode=1;
}

main().catch(error=>{console.error(error);process.exit(1);});
