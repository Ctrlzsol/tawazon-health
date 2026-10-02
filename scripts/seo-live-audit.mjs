import fs from 'node:fs';

const SITE="https://tawazon-health.vercel.app";
const URLS=["/","/library.html","/article-protein-basics.html","/sleep-calculator.html"];
const EXPECTED_404=["/this-route-does-not-exist-20261003","/article-not-a-real-article-20261003"];
const NOINDEX_TESTS=[];
const LEGACY_REDIRECTS=["/index.html"];
const EXTRA_ORIGINS=[];
const QUERY_TESTS=["/library.html","/article-protein-basics.html"];
const SLASH_TESTS=[];
const INDEX_TESTS=["/index.html"];

const errors=[];
const warnings=[];
const report={site:SITE,startedAt:new Date().toISOString(),sitemap:{},pages:[],links:{},redirectTests:[],normalization:[],errors,warnings};

function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
async function request(url,method='GET'){
  const started=Date.now();
  const response=await fetch(url,{method,redirect:'manual',headers:{'user-agent':'SEO-Engineering-Audit/1.0'}});
  const body=method==='GET'?await response.text():'';
  return {
    url,status:response.status,location:response.headers.get('location')||'',
    contentType:response.headers.get('content-type')||'',
    robotsHeader:response.headers.get('x-robots-tag')||'',
    contentLength:Number(response.headers.get('content-length')||Buffer.byteLength(body,'utf8')),
    elapsedMs:Date.now()-started,body,headers:response.headers
  };
}
function attrs(tag){
  const out={};
  const pattern=/([\w:-]+)\s*=\s*["']([^"']*)["']/g;
  for(const match of tag.matchAll(pattern))out[match[1].toLowerCase()]=match[2];
  return out;
}
function meta(html,name){
  for(const part of html.split('<meta').slice(1)){
    const tag='<meta'+part.split('>')[0]+'>';
    const a=attrs(tag);
    if((a.name||'').toLowerCase()===name.toLowerCase())return a.content||'';
  }
  return '';
}
function canonical(html){
  for(const part of html.split('<link').slice(1)){
    const tag='<link'+part.split('>')[0]+'>';
    const a=attrs(tag);
    if((a.rel||'').toLowerCase().split(/\s+/).includes('canonical'))return a.href||'';
  }
  return '';
}
function title(html){return html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim()||'';}
function h1Count(html){return (html.match(/<h1(?:\s|>)/gi)||[]).length;}
function jsonLd(html){
  const out=[];
  for(const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
    try{out.push(JSON.parse(m[1]));}catch(e){errors.push('invalid JSON-LD: '+e.message);}
  }
  return out;
}
function flattenSchema(data){
  if(Array.isArray(data))return data;
  if(data&&Array.isArray(data['@graph']))return data['@graph'];
  return data?[data]:[];
}
function internalLinks(html,pageUrl){
  const found=new Set();
  for(const m of html.matchAll(/href=["']([^"']+)["']/gi)){
    const raw=m[1];
    if(!raw||raw.startsWith('#')||raw.startsWith('mailto:')||raw.startsWith('tel:')||raw.startsWith('javascript:'))continue;
    try{
      const u=new URL(raw,pageUrl);
      if(u.origin!==new URL(SITE).origin)continue;
      if(/^\/(api|assets?)(\/|$)/.test(u.pathname))continue;
      if(/\\.(css|js|json|png|jpe?g|gif|svg|webp|ico|xml|txt|pdf|woff2?)$/i.test(u.pathname))continue;
      u.search='';u.hash='';
      found.add(u.href);
    }catch{}
  }
  return [...found];
}
function normalizeUrl(url){
  const u=new URL(url);
  u.hash='';
  if(u.pathname!=='/'&&u.pathname.endsWith('/'))u.pathname=u.pathname.slice(0,-1);
  return u.href;
}

const robotsRes=await request(SITE+'/robots.txt');
if(robotsRes.status!==200)errors.push('robots.txt returned '+robotsRes.status);
if(!/Sitemap:\s*https://tawazon-health\\.vercel\\.app\/sitemap\\.xml/i.test(robotsRes.body))errors.push('robots.txt is missing canonical sitemap directive');
report.robots={status:robotsRes.status,contentType:robotsRes.contentType};
const sitemapRes=await request(SITE+'/sitemap.xml');
if(sitemapRes.status!==200)errors.push('sitemap.xml returned '+sitemapRes.status);
if(!/xml/i.test(sitemapRes.contentType))warnings.push('sitemap content-type is '+sitemapRes.contentType);
const sitemapUrls=[];
for(const m of sitemapRes.body.matchAll(/<loc>([^<]+)<\/loc>/g))sitemapUrls.push(m[1].trim());
report.sitemap={status:sitemapRes.status,count:sitemapUrls.length,contentType:sitemapRes.contentType};

const targetUrls=[...new Set([...sitemapUrls,...URLS.map(x=>new URL(x,SITE).href)])];
const incoming=new Map(targetUrls.map(u=>[normalizeUrl(u),0]));
const discoveredLinks=new Map();
const requestQueue=targetUrls.slice(0,300);

for(let i=0;i<requestQueue.length;i++){
  const url=requestQueue[i];
  const res=await request(url);
  const page={url,status:res.status,location:res.location,elapsedMs:res.elapsedMs,contentLength:res.contentLength,robots:res.robotsHeader,title:'',canonical:'',metaRobots:'',h1:0,internalLinks:[]};
  if(res.status>=300&&res.status<400)errors.push('sitemap/page URL redirects: '+url+' -> '+res.location);
  if(res.status!==200)errors.push('page returned '+res.status+': '+url);
  if(res.elapsedMs>2500)warnings.push('slow response '+res.elapsedMs+'ms: '+url);

  if(res.contentLength>500000)warnings.push('HTML >500KB: '+url+' ('+res.contentLength+')');
  if(res.status===200&&/text\/html/i.test(res.contentType)){
    page.title=title(res.body);page.canonical=canonical(res.body);page.metaRobots=meta(res.body,'robots');page.h1=h1Count(res.body);const bodyText=res.body.replace(/<script[\s\\S]*?<\/script>/gi,' ').replace(/<style[\s\\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();page.textChars=bodyText.length;
  
    if(!page.title)errors.push('missing title: '+url);
    if(!meta(res.body,'description'))errors.push('missing meta description: '+url);
    if(!page.canonical)errors.push('missing canonical: '+url);
    if(page.h1<1)errors.push('missing H1: '+url);
    if(page.h1>1)warnings.push('multiple H1 ('+page.h1+'): '+url);
    if(!/<html[^>]+lang=["']ar["']/i.test(res.body))warnings.push('missing lang=ar: '+url);
    if(!/<html[^>]+dir=["']rtl["']/i.test(res.body))warnings.push('missing dir=rtl: '+url);
    if(page.canonical){
      try{
        const c=normalizeUrl(page.canonical);
        const expected=normalizeUrl(url);
        if(new URL(page.canonical).origin!==new URL(SITE).origin)errors.push('off-domain canonical: '+url+' -> '+page.canonical);
        if(new URL(page.canonical).search||new URL(page.canonical).hash)errors.push('canonical has query/hash: '+url);
        if(c!==expected)errors.push('canonical mismatch: '+url+' -> '+page.canonical);
      }catch{errors.push('invalid canonical: '+url+' -> '+page.canonical);}
    }
    const og=meta(res.body,'og:url');
    if(og&&page.canonical&&normalizeUrl(og)!==normalizeUrl(page.canonical))errors.push('og:url differs from canonical: '+url);
    if(/noindex/i.test(page.metaRobots)&&sitemapUrls.includes(url))errors.push('sitemap contains noindex page: '+url);
    if(/noindex/i.test(page.robotsHeader)&&sitemapUrls.includes(url))errors.push('sitemap URL has X-Robots noindex: '+url);
    if(!/noindex/i.test(page.metaRobots)&&/noindex/i.test(page.robotsHeader)&&sitemapUrls.includes(url))errors.push('HTML/header robots conflict: '+url);
    if(/noindex/i.test(page.robotsHeader)&&sitemapUrls.includes(url))errors.push('sitemap contains header-noindex page: '+url);
    const schemas=jsonLd(res.body);
    for(const data of schemas){
      for(const node of flattenSchema(data)){
        const types=Array.isArray(node?.['@type'])?node['@type']:[node?.['@type']];
        if(types.includes('BreadcrumbList')&&!Array.isArray(node.itemListElement))errors.push('invalid BreadcrumbList: '+url);
        if(types.includes('Article')&&!node.headline)errors.push('Article missing headline: '+url);
        if(types.includes('Article')&&node.url&&normalizeUrl(node.url)!==normalizeUrl(url))warnings.push('Article url differs from page: '+url);
        if(types.includes('WebSite')&&!node.url)errors.push('WebSite missing url: '+url);
      }
    }
    page.internalLinks=internalLinks(res.body,url);
    discoveredLinks.set(normalizeUrl(url),page.internalLinks.map(normalizeUrl));
    for(const link of page.internalLinks){
      const key=normalizeUrl(link);
      if(incoming.has(key))incoming.set(key,incoming.get(key)+1);
      else if(!incoming.has(key)&&requestQueue.length<500){incoming.set(key,0);requestQueue.push(link);}
    }
  }
  report.pages.push(page);
  await sleep(20);
}

for(const u of sitemapUrls){
  try{
    const parsed=new URL(u);
    if(parsed.origin!==new URL(SITE).origin)errors.push('off-origin sitemap URL: '+u);
    if(parsed.protocol!=='https:')errors.push('non-HTTPS sitemap URL: '+u);
    if(parsed.search||parsed.hash)errors.push('query/hash sitemap URL: '+u);
    const nu=normalizeUrl(u);
    if(sitemapUrls.filter(x=>normalizeUrl(x)===nu).length>1)errors.push('duplicate normalized sitemap URL: '+u);
  }catch{errors.push('invalid sitemap URL: '+u);}
}

const sitemapSet=new Set(sitemapUrls.map(normalizeUrl));
for(const [url,count] of incoming){
  if(sitemapSet.has(url)&&url!==normalizeUrl(SITE+'/')&&count===0)warnings.push('orphan sitemap page (no internal HTML link found): '+url);
}
report.links={crawledPages:discoveredLinks.size,internalTargets:incoming.size,orphanCount:[...incoming].filter(([u,c])=>sitemapSet.has(u)&&u!==normalizeUrl(SITE+'/')&&c===0).length};

for(const path of EXPECTED_404){
  const res=await request(new URL(path,SITE).href);
  if(res.status!==404)errors.push('expected 404 but got '+res.status+': '+path);
}
for(const path of NOINDEX_TESTS){
  const res=await request(new URL(path,SITE).href);
  if(res.status!==200)warnings.push('private test returned '+res.status+': '+path);
  if(!/noindex/i.test(res.robotsHeader)&&!/noindex/i.test(meta(res.body,'robots')))warnings.push('private route lacks noindex signals: '+path);
}
for(const path of QUERY_TESTS){
  const res=await request(new URL(path+'?utm_source=seo-audit',SITE).href);
  if(!(res.status===200||res.status===301||res.status===308))errors.push('query normalization returned '+res.status+': '+path);
  if(res.status===200){
    const c=canonical(res.body);
    if(c&&/[?].*utm_source/.test(c))errors.push('canonical preserves tracking query: '+path+' -> '+c);
  }
}
for(const path of SLASH_TESTS){
  const res=await request(new URL(path,SITE).href);
  if(res.status===404)errors.push('trailing-slash variant 404: '+path);
}
for(const path of INDEX_TESTS){
  const res=await request(new URL(path,SITE).href);
  if(res.status===200)warnings.push('index.html serves 200; verify canonical strategy: '+path);
}
for(const path of LEGACY_REDIRECTS){
  const res=await request(new URL(path,SITE).href);
  if(!(res.status>=300&&res.status<400))warnings.push('legacy route did not return redirect: '+path+' => '+res.status);
  else report.redirectTests.push({source:path,status:res.status,location:res.location});
}

const origin=new URL(SITE);
const http='http://'+origin.host+'/';
const httpRes=await request(http);
report.normalization.push({test:http,status:httpRes.status,location:httpRes.location});
if(!(httpRes.status>=300&&httpRes.status<400))warnings.push('HTTP origin does not redirect to HTTPS: '+httpRes.status);
for(const extra of EXTRA_ORIGINS){
  const r=await request(extra+'/');
  report.normalization.push({test:extra+'/',status:r.status,location:r.location});
  if(!(r.status>=300&&r.status<400)&&r.status!==200)warnings.push('alternate hostname response: '+extra+' => '+r.status);
  if(r.status===200)warnings.push('alternate hostname serves 200; verify canonical hostname strategy: '+extra);
}

report.finishedAt=new Date().toISOString();
fs.writeFileSync('seo-live-audit.json',JSON.stringify(report,null,2));
if(errors.length){
  console.error(JSON.stringify({errors,warnings},null,2));
  process.exit(1);
}
console.log(JSON.stringify(report,null,2));
