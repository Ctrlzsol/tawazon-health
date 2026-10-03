import fs from 'node:fs';
import path from 'node:path';

const SITE='https://tawazon-health.vercel.app';
const KIND='tawazon';
const PUBLISHER='ca-pub-1304668609520202';
const ROOT=fs.existsSync('dist')?path.resolve('dist'):path.resolve('.');
const blocking=[];
const warnings=[];
const manual=[];

const CONTENT_PATTERNS={
  jadwa:[/^\/$/, /^\/blog(?:\/|$)/, /^\/guides(?:\/|$)/],
  muwathaq:[/^\/$/, /^\/guide$/, /^\/guides(?:\/|$)/],
  tawazon:[/^\/$/, /^\/library(?:\.html)?$/, /^\/article-[^/]+\.html$/, /^\/topic-[^/]+\.html$/]
};
const POLICY_PATTERNS=[
  /^\/privacy(?:\.html|\/|$)/,/^\/terms(?:\.html|\/|$)/,/^\/contact(?:\.html|\/|$)/,
  /^\/about(?:\.html|\/|$)/,/^\/editorial(?:\.html|\/|$)/,/^\/review-process(?:\.html|\/|$)/,
  /^\/disclaimer(?:\.html|\/|$)/,/^\/404(?:\.html|\/|$)/
];
const PRIVATE_PATTERNS=[
  /^\/admin(?:\/|$)/,/^\/account(?:\/|$)/,/^\/login(?:\/|$)/,/^\/signup(?:\/|$)/,
  /^\/checkout(?:\/|$)/,/^\/payment(?:\/|$)/,/^\/documents(?:\/|$)/,/^\/create(?:\/|$)/,
  /^\/activate(?:\/|$)/
];

function walk(dir){
  if(!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
    const full=path.join(dir,entry.name);
    if(entry.name.startsWith('.')||entry.name==='node_modules') return [];
    return entry.isDirectory()?walk(full):[full];
  });
}
function read(file){return fs.readFileSync(file,'utf8');}
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
  const re=new RegExp("\\b"+name+"\\s*=\\s*([\\\"'])(.*?)\\1","i");
  const m=tag.match(re);
  return m?m[2]:'';
}
function meta(html,name){
  for(const tag of tags(html,'meta')){
    if(attr(tag,'name').toLowerCase()===name.toLowerCase()) return attr(tag,'content').trim();
  }
  return '';
}
function canonical(html){
  for(const tag of tags(html,'link')){
    if(attr(tag,'rel').toLowerCase().split(/\s+/).includes('canonical')) return attr(tag,'href').trim();
  }
  return '';
}
function title(html){
  const lower=html.toLowerCase();
  const start=lower.indexOf('<title');
  if(start<0) return '';
  const openEnd=html.indexOf('>',start);
  const close=lower.indexOf('</title>',openEnd);
  return openEnd>=0&&close>openEnd?html.slice(openEnd+1,close).trim():'';
}
function routeOf(file){
  const rel=path.relative(ROOT,file).replaceAll(path.sep,'/');
  if(rel==='index.html') return '/';
  if(rel.endsWith('/index.html')) return '/'+rel.slice(0,-11);
  return '/'+rel.replace(/\.html$/,'');
}
function isContent(route){return CONTENT_PATTERNS[KIND].some(re=>re.test(route));}
function isPolicy(route){return POLICY_PATTERNS.some(re=>re.test(route));}
function isPrivate(route){return PRIVATE_PATTERNS.some(re=>re.test(route));}
function noindex(html){return /\bnoindex\b/i.test(meta(html,'robots'));}
function adLoader(html){return html.includes('pagead2.googlesyndication.com/pagead/js/adsbygoogle.js');}
function directLoader(html){
  return /<script[^>]+src=["']https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client=ca-pub-1304668609520202["']/i.test(html);
}
function conditionalLoader(html){
  return html.includes('document.createElement("script")')&&adLoader(html);
}
function effectiveLoader(html,route){
  if(directLoader(html)) return true;
  if(!conditionalLoader(html)) return false;
  return isContent(route);
}
function adUnit(html){
  return /class=["'][^"']*adsbygoogle[^"']*["']/i.test(html) ||
    /data-ad-client=["']ca-pub-1304668609520202["']/i.test(html);
}
function publisherMeta(html){
  return /<meta[^>]+name=["']google-adsense-account["'][^>]+content=["']ca-pub-1304668609520202["']/i.test(html);
}
function hasArabicLang(html){return /<html[^>]+lang=["']ar["']/i.test(html);}

const htmlFiles=walk(ROOT).filter(file=>file.endsWith('.html'));
let verificationPages=0;
let contentWithAds=0;
const adRoutes=[];
const titleMap=new Map();
const descriptionMap=new Map();

for(const file of htmlFiles){
  const html=read(file);
  const route=routeOf(file);
  const content=isContent(route)&&!noindex(html);

  if(content){
    if(publisherMeta(html)) verificationPages++;
    if(effectiveLoader(html,route)||adUnit(html)) contentWithAds++;
    const t=title(html), d=meta(html,'description');
    if(t){
      if(titleMap.has(t)) warnings.push('Duplicate content title: '+route+' and '+titleMap.get(t));
      else titleMap.set(t,route);
    }
    if(d){
      if(descriptionMap.has(d)) warnings.push('Duplicate meta description: '+route+' and '+descriptionMap.get(d));
      else descriptionMap.set(d,route);
    }
    if(!hasArabicLang(html)) warnings.push('Content page missing lang="ar": '+route);
    if(noindex(html)) blocking.push('Content page marked noindex: '+route);
  }

  const hasLoader=effectiveLoader(html,route);
  const hasUnit=adUnit(html);
  if((hasLoader||hasUnit)&&(isPolicy(route)||isPrivate(route))){
    blocking.push('AdSense placement/code on policy/private utility page: '+route);
  }
  if((hasLoader||hasUnit)&&noindex(html)){
    blocking.push('AdSense placement/code on noindex page: '+route);
  }
  if(hasLoader||hasUnit) adRoutes.push(route);

  if(content&&!title(html)) blocking.push('Content page missing title: '+route);
  if(content&&!meta(html,'description')) blocking.push('Content page missing meta description: '+route);
  if(content&&!canonical(html)) blocking.push('Content page missing canonical: '+route);
}

if(verificationPages===0) blocking.push('No public content page contains the AdSense publisher verification meta tag.');
if(contentWithAds===0) manual.push('No active AdSense loader/unit was detected on a public content page; verify site ownership and AdSense account setup manually.');

const adsPaths=[path.join(ROOT,'ads.txt'),path.resolve('ads.txt')].filter((f,i,a)=>{
  return fs.existsSync(f)&&fs.statSync(f).isFile()&&a.indexOf(f)===i;
});
const expectedAds='google.com, pub-1304668609520202, DIRECT, f08c47fec0942fa0';
if(adsPaths.length){
  const text=adsPaths.map(read).join('\n');
  if(!text.split(/\r?\n/).some(line=>line.trim()===expectedAds)){
    blocking.push('ads.txt is present but missing the exact Google publisher authorization line.');
  }
}else{
  warnings.push('ads.txt is absent. Google says it is not mandatory, but recommends it.');
}

const privacy=htmlFiles.find(f=>{
  const rel=path.relative(ROOT,f).replaceAll(path.sep,'/');
  return /(^|\/)privacy(?:\/index)?\.html$/i.test(rel);
});
if(!privacy){
  blocking.push('Privacy policy page not found.');
}else{
  const p=read(privacy);
  if(!/Google/i.test(p)) blocking.push('Privacy policy does not disclose Google advertising/data use.');
  if(!/cookie|ملفات تعريف الارتباط|ملفات الارتباط/i.test(p)) blocking.push('Privacy policy does not disclose cookies.');
  if(!/myadcenter\.google\.com|مركز إعلانات Google|Ads Settings/i.test(p)){
    warnings.push('Privacy policy does not expose a direct Google ad-personalization control link.');
  }
  if(!/policies\.google\.com\/technologies\/partner-sites/i.test(p)){
    warnings.push('Privacy policy does not link to Google partner-site data-use disclosure.');
  }
}

const availableRoutes=new Set(htmlFiles.map(routeOf));
if(!['/about','/about.html'].some(x=>availableRoutes.has(x))&&kind!=='tawazon'){
  warnings.push('Recommended About/transparency page not found.');
}
if(!['/contact','/contact.html'].some(x=>availableRoutes.has(x))){
  warnings.push('Recommended Contact page not found.');
}

const robotsStatic=[path.join(ROOT,'robots.txt'),path.resolve('robots.txt')].filter((f,i,a)=>{
  return fs.existsSync(f)&&fs.statSync(f).isFile()&&a.indexOf(f)===i;
});
if(!robotsStatic.length){
  const apiRobots=path.resolve('api','robots.js');
  if(fs.existsSync(apiRobots)) manual.push('robots.txt is generated dynamically; verify the live /robots.txt response.');
  else warnings.push('No robots.txt source found.');
}

const cmpDetected=htmlFiles.some(f=>/googlefc|fundingchoicesmessages|__tcfapi|onetrust|consentmanager/i.test(read(f)));
if(!cmpDetected&&adRoutes.length){
  manual.push('Before personalized ads are served in the EEA, UK or Switzerland, configure a Google-certified CMP integrated with IAB TCF or another Google-supported consent setup.');
}

if(KIND==='tawazon'){
  const contentText=htmlFiles.filter(f=>isContent(routeOf(f))).map(read).join('\n');
  if(/setTargeting\s*\(|google_ad_(?:channel|test|host|format|safe|section)|data-ad-keywords|remarketing|user_provided_data|customer_match/i.test(contentText)){
    blocking.push('Custom audience/remarketing targeting detected on health content. Remove it before serving personalized ads.');
  }
}

const report={
  site:SITE,
  publisherId:PUBLISHER,
  publicContentPages:[...new Set(htmlFiles.map(routeOf).filter(isContent))].length,
  verificationPages,
  contentWithAds,
  adCodeRoutes:[...new Set(adRoutes)].sort(),
  adsTxtPresent:adsPaths.length>0,
  privacyPolicyPresent:!!privacy,
  cmpDetected,
  blocking,
  warnings,
  manual,
  googleRequirements:{
    originalHighQualityContent:'manual review required',
    clearNavigation:'automated content graph + manual UX review',
    policyCompliance:'manual review required',
    sourceCodeAccess:true,
    primaryLanguage:'Arabic supported',
    siteLive:'live verification required',
    ssl:'live verification required',
    ownershipVerification:verificationPages>0,
    adsTxt:adsPaths.length>0?'present':'optional',
    personalizedAdsConsent:'Google-certified CMP/consent configuration required where applicable'
  }
};
fs.writeFileSync('adsense-readiness.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(blocking.length) process.exit(1);
