import fs from 'node:fs';
import path from 'node:path';

const SITE="https://tawazon-health.vercel.app";
const KIND="tawazon";
const PUBLISHER='ca-pub-1304668609520202';
const ROOT=fs.existsSync('dist')?path.resolve('dist'):path.resolve('.');
const blocking=[];
const warnings=[];
const manual=[];

const CONTENT_PATTERNS={
  jadwa:[/^\/$/,/^\/blog(?:\/|$)/,/^\/guides(?:\/|$)/],
  muwathaq:[/^\/$/,/^\/guide$/, /^\/guides(?:\/|$)/],
  tawazon:[/^\/$/,/^\/library(?:\.html)?$/, /^\/article-[^/]+\.html$/, /^\/topic-[^/]+\.html$/]
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
function attr(tag,name){
  const lower=tag.toLowerCase();
  const p1=lower.indexOf(name.toLowerCase()+'="');
  if(p1>=0){
    const start=p1+name.length+2;
    const end=tag.indexOf('"',start);
    if(end>=0) return tag.slice(start,end);
  }
  const p2=lower.indexOf(name.toLowerCase()+"='");
  if(p2>=0){
    const start=p2+name.length+2;
    const end=tag.indexOf("'",start);
    if(end>=0) return tag.slice(start,end);
  }
  return '';
}
function tags(html,name){
  const out=[];
  const lower=html.toLowerCase();
  const needle='<'+name.toLowerCase();
  let p=0;
  while((p=lower.indexOf(needle,p))>=0){
    const e=html.indexOf('>',p);
    if(e<0) break;
    out.push(html.slice(p,e+1));
    p=e+1;
  }
  return out;
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
  const l=html.toLowerCase();
  const s=l.indexOf('<title');
  if(s<0) return '';
  const e=html.indexOf('>',s);
  const c=l.indexOf('</title>',e);
  return e>=0&&c>e?html.slice(e+1,c).trim():'';
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
function hasAdLoader(html){
  return html.includes('pagead2.googlesyndication.com/pagead/js/adsbygoogle.js');
}
function hasDirectLoader(html){
  return /<script[^>]+src=["']https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client=ca-pub-1304668609520202["'][^>]*>/i.test(html);
}
function hasAdUnit(html){
  return /class=["'][^"']*adsbygoogle[^"']*["']/i.test(html) || /data-ad-client=["']ca-pub-1304668609520202["']/i.test(html);
}
function publisherMeta(html){
  return /<meta[^>]+name=["']google-adsense-account["'][^>]+content=["']ca-pub-1304668609520202["']/i.test(html);
}

const files=walk(ROOT).filter(file=>file.endsWith('.html'));
let verificationPages=0;
const adPages=[];
const publicContentPages=[];

for(const file of files){
  const html=read(file);
  const route=routeOf(file);
  const isPublic=!isPrivate(route);
  if(isPublic&&publisherMeta(html)) verificationPages++;
  if(isContent(route)&&!noindex(html)) publicContentPages.push({file,route,html});
  const loader=hasAdLoader(html);
  const direct=hasDirectLoader(html);
  const unit=hasAdUnit(html);

  if(loader&&(isPolicy(route)||isPrivate(route)||route==='/404')){
    blocking.push('AdSense loader present on policy/private/404 page: '+route);
  }
  if(unit&&(isPolicy(route)||isPrivate(route)||route==='/404')){
    blocking.push('AdSense ad unit present on policy/private/404 page: '+route);
  }
  if(unit&&!isContent(route)&&!noindex(html)){
    blocking.push('AdSense ad unit outside approved editorial content route: '+route);
  }
  if((loader||unit)&&noindex(html)&&!isContent(route)){
    warnings.push('AdSense code found on noindex non-content page: '+route);
  }
  if(loader||unit) adPages.push(route);
}

if(!publicContentPages.length) blocking.push('No public content pages detected.');
if(verificationPages===0) blocking.push('No public page contains the AdSense publisher verification meta tag.');
if(!publicContentPages.some(p=>hasAdLoader(p.html)||hasAdUnit(p.html))){
  manual.push('No effective AdSense loader/unit detected on a public content page; site ownership verification may still use the publisher meta tag.');
}

const adsTxtCandidates=[
  path.join(ROOT,'ads.txt'),
  path.resolve('ads.txt')
].filter((file,i,a)=>fs.existsSync(file)&&fs.statSync(file).isFile()&&a.indexOf(file)===i);
if(adsTxtCandidates.length){
  const text=adsTxtCandidates.map(read).join('\n');
  const expected='google.com, pub-1304668609520202, DIRECT, f08c47fec0942fa0';
  if(!text.split(/\r?\n/).some(line=>line.trim()===expected)) blocking.push('ads.txt exists but is missing the exact AdSense authorization line.');
}else{
  warnings.push('ads.txt is not present. Google states it is not mandatory, but recommends it strongly.');
}

const privacyCandidates=files.filter(file=>{
  const rel=path.relative(ROOT,file).replaceAll(path.sep,'/');
  return /(^|\/)privacy(?:\/index)?\.html$/i.test(rel)||/\/privacy\.html$/i.test('/'+rel);
});
if(!privacyCandidates.length){
  blocking.push('Privacy policy page not found.');
}else{
  const privacy=read(privacyCandidates[0]);
  if(!/Google/i.test(privacy)) blocking.push('Privacy policy does not disclose Google advertising/data use.');
  if(!/cookie|ملفات تعريف الارتباط|ملفات الارتباط/i.test(privacy)) blocking.push('Privacy policy does not disclose cookies.');
  if(!/myadcenter\.google\.com|مركز إعلانات Google|Ads Settings/i.test(privacy)) blocking.push('Privacy policy has no Google ad-personalization control.');
  if(!/policies\.google\.com\/technologies\/partner-sites/i.test(privacy)) warnings.push('Privacy policy does not link to Google partner-site data-use disclosure.');
}

const siteText=files.filter(file=>isContent(routeOf(file))).map(read).join('\n');
if(KIND==='tawazon'){
  if(/setTargeting\s*\(|google_ad_(?:channel|test|host|format|safe|section)|data-ad-keywords|remarketing|user_provided_data|customer_match/i.test(siteText)){
    blocking.push('Detected custom audience/ad targeting logic on health content. Remove it; Google restricts personalized advertising based on health/medical information.');
  }
}

const robotsCandidates=[
  path.join(ROOT,'robots.txt'),path.resolve('robots.txt'),
  path.resolve('api','robots.js')
].filter((file,i,a)=>fs.existsSync(file)&&a.indexOf(file)===i);
if(!robotsCandidates.length) warnings.push('No robots.txt source found; verify the live endpoint separately.');
else if(robotsCandidates.some(file=>file.endsWith('robots.js'))&&!robotsCandidates.some(file=>file.endsWith('robots.txt'))){
  manual.push('robots.txt is generated by a serverless endpoint; validate the live /robots.txt response separately.');
}

const cmpPatterns=/googlefc|fundingchoicesmessages|__tcfapi|onetrust|consentmanager/i;
const cmpDetected=files.some(file=>cmpPatterns.test(read(file)));
if(!cmpDetected&&adPages.length){
  manual.push('No Google-certified TCF CMP detected in source. Before serving personalized ads to EEA/UK/Switzerland traffic, configure a Google-certified CMP integrated with IAB TCF or an appropriate Google-supported consent setup.');
}

if(!/lang=["']ar["']/i.test(files.length?read(files[0]):'')){
  warnings.push('HTML language metadata is not detectable as Arabic on the first scanned page.');
}

const report={
  site:SITE,
  publisherId:PUBLISHER,
  publicContentPages:publicContentPages.length,
  adCodeRoutes:[...new Set(adPages)].sort(),
  publisherVerificationPages:verificationPages,
  adsTxtPresent:adsTxtCandidates.length>0,
  privacyPolicyPresent:privacyCandidates.length>0,
  cmpDetected,
  blocking,
  warnings,
  manual,
  googleRequirements:{
    ownOriginalHighQualityContent:'MANUAL_REVIEW',
    clearNavigation:'AUTOMATED_CONTENT_GRAPH_SEPARATE',
    policyCompliance:'MANUAL_REVIEW',
    sourceCodeAccess:true,
    supportedPrimaryLanguage:'Arabic supported',
    siteLiveAndReachable:'LIVE_AUDIT_REQUIRED',
    sslHttps:'LIVE_AUDIT_REQUIRED',
    privacyDisclosure:privacyCandidates.length>0,
    publisherVerification:verificationPages>0,
    adsTxt:adsTxtCandidates.length>0?'PRESENT':'OPTIONAL_NOT_PRESENT',
    consentForPersonalizedAds:'ACCOUNT_OR_CMP_SETUP_REQUIRED'
  }
};

fs.writeFileSync('adsense-readiness.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(blocking.length) process.exit(1);
