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
  for(const quote of ['"',"']){
    const marker=name.toLowerCase()+'='+quote;
    const start=lower.indexOf(marker);
    if(start<0) continue;
    const from=start+marker.length;
    const end=tag.indexOf(quote,from);
    if(end>=0) return tag.slice(from,end);
  }
  return '';
}
function tags(html,name){
  const out=[];const lower=html.toLowerCase();const needle='<'+name.toLowerCase();let p=0;
  while((p=lower.indexOf(needle,p))>=0){
    const e=html.indexOf('>',p);if(e<0)break;
    out.push(html.slice(p,e+1));p=e+1;
  }
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
function title(html){
  const lower=html.toLowerCase();const start=lower.indexOf('<title');if(start<0)return '';
  const openEnd=html.indexOf('>',start);const close=lower.indexOf('</title>',openEnd);
  return openEnd>=0&&close>openEnd?html.slice(openEnd+1,close).trim():'';
}
function routeOf(file){
  const rel=path.relative(ROOT,file).replaceAll(path.sep,'/');
  if(rel==='index.html')return '/';
  if(rel.endsWith('/index.html'))return '/'+rel.slice(0,-11);
  return '/'+rel.replace(/\.html$/,'');
}
function isContent(route){return CONTENT_PATTERNS[KIND].some(re=>re.test(route));}
function isPolicy(route){return POLICY_PATTERNS.some(re=>re.test(route));}
function isPrivate(route){return PRIVATE_PATTERNS.some(re=>re.test(route));}
function noindex(html){return /\bnoindex\b/i.test(meta(html,'robots'));}
function adLoader(html){return html.includes('pagead2.googlesyndication.com/pagead/js/adsbygoogle.js');}
function directLoader(html){return /<script[^>]+src=["']https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client=ca-pub-1304668609520202["']/i.test(html);}
function conditionalLoader(html){return html.includes('document.createElement("script")')&&adLoader(html);}
function effectiveLoader(html,route){
  if(directLoader(html)) return true;
  if(!conditionalLoader(html)) return false;
  return isContent(route);
}
function adUnit(html){return /class=["'][^"']*adsbygoogle[^"']*["']/i.test(html)||/data-ad-client=["']ca-pub-1304668609520202["']/i.test(html);}
function publisherMeta(html){return /<meta[^>]+name=["']google-adsense-account["'][^>]+content=["']ca-pub-1304668609520202["']/i.test(html);}
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
  const c=isContent(route)&&!noindex(html);
  if(c){
    if(publisherMeta(html))verificationPages++;
    if(adLoader(html)||adUnit(html))contentWithAds++;
    const t=title(html),d=meta(html,'description');
    if(t){if(titleMap.has(t))warnings.push('Duplicate content title: '+route+' and '+titleMap.get(t));else titleMap.set(t,route);}
    if(d){if(descriptionMap.has(d))warnings.push('Duplicate meta description: '+route+' and '+descriptionMap.get(d));else descriptionMap.set(d,route);}
    if(!hasArabicLang(html))warnings.push('Content page missing lang="ar": '+route);
  }

  const hasLoader=effectiveLoader(html,route), hasUnit=adUnit(html);
  if((hasLoader||hasUnit) && (isPolicy(route)||isPrivate(route))){
    blocking.push('AdSense code on policy/private utility page: '+route);
  }
  if((hasLoader||hasUnit) && noindex(html)){
    blocking.push('AdSense code on noindex page: '+route);
  }
  if(hasLoader||hasUnit)adRoutes.push(route);
  if(c && !title(html))blocking.push('Content page missing title: '+route);
  if(c && !meta(html,'description'))blocking.push('Content page missing meta description: '+route);
  if(c && !canonical(html))blocking.push('Content page missing canonical: '+route);
}

if(verificationPages===0)blocking.push('No content page contains the AdSense publisher verification meta tag.');
if(contentWithAds===0)manual.push('No effective AdSense loader/unit detected on content HTML. The publisher meta tag is present, but verify the AdSense Site verification state in the account.');

const adsPaths=[path.join(ROOT,'ads.txt'),path.resolve('ads.txt')].filter((f,i,a)=>fs.existsSync(f)&&fs.statSync(f).isFile()&&a.indexOf(f)===i);
const expectedAds='google.com, pub-1304668609520202, DIRECT, f08c47fec0942fa0';
if(adsPaths.length){
  const text=adsPaths.map(read).join('\n');
  if(!text.split(/\r?\n/).some(line=>line.trim()===expectedAds))blocking.push('ads.txt is present but missing the exact Google publisher line.');
}else warnings.push('ads.txt is absent. It is recommended by Google but is not an AdSense approval prerequisite.');

const privacy=htmlFiles.find(f=>/\/privacy\.html$|\/privacy\/index\.html$|^privacy\.html$/i.test(f.replaceAll(path.sep,'/')));
if(!privacy){
  blocking.push('Privacy policy page not found.');
}else{
  const p=read(privacy);
  if(!/Google/i.test(p))blocking.push('Privacy policy does not disclose Google advertising/data use.');
  if(!/cookie|ملفات تعريف الارتباط|ملفات الارتباط/i.test(p))blocking.push('Privacy policy does not disclose cookies.');
  if(!/myadcenter\.google\.com|مركز إعلانات Google|Ads Settings/i.test(p))warnings.push('Privacy policy lacks a direct Google Ads personalization control link.');
  if(!/policies\.google\.com\/technologies\/partner-sites/i.test(p))warnings.push('Privacy policy lacks Google partner-site data-use reference.');
}

const requiredQualityRoutes=['/about','/contact'];
const availableRoutes=new Set(htmlFiles.map(routeOf));
for(const route of requiredQualityRoutes){
  const equivalent=route==='about'?['/about','/about.html']:['/contact','/contact.html'];
  if(!equivalent.some(x=>availableRoutes.has(x))) warnings.push('Recommended transparency page not found: '+route);
}

const robotsFiles=[path.join(ROOT,'robots.txt'),path.resolve('robots.txt')].filter((f,i,a)=>fs.existsSync(f)&&fs.statSync(f).isFile()&&a.indexOf(f)===i);
if(!robotsFiles.length){
  const apiRobots=path.resolve('api','robots.js');
  if(fs.existsSync(apiRobots)) manual.push('robots.txt is generated dynamically by api/robots.js; verify the live /robots.txt response.');
  else warnings.push('No local robots.txt source found.');
}

const cmpDetected=htmlFiles.some(f=>/googlefc|fundingchoicesmessages|__tcfapi|onetrust|consentmanager/i.test(read(f)));
if(!cmpDetected && adRoutes.length){
  manual.push('No certified TCF CMP detected in source. Before personalized ads are served to EEA/UK/Switzerland users, configure a Google-certified CMP integrated with IAB TCF or use an appropriate Google-supported consent setup.');
}

if(KIND==='tawazon'){
  const sourceText=htmlFiles.map(read).join('\n');
  if(/setTargeting\s*\(|google_ad_(?:channel|test|host|format|safe|section)|data-ad-keywords|remarketing|user_provided_data|customer_match/i.test(sourceText)){
    blocking.push('Potential custom audience/remarketing targeting detected on health content; remove it before serving personalized ads.');
  }
}

const report={
  site:SITE,
  publisherId:PUBLISHER,
  publicContentPages:[...new Set(htmlFiles.map(routeOf).filter(isContent))].length,
  verificationPages,
  contentWithAds,
  adCodeRoutes:[...new Set(adRoutes)].sort(),
  adsTxt:{present:adsPaths.length>0,expectedLine:expectedAds},
  privacyPolicyPresent:!!privacy,
  cmpDetected,
  blocking,
  warnings,
  manual,
  google:{supportedPrimaryLanguage:'Arabic',sourceCodeAccess:true,originalContent:'manual review required',policyCompliance:'manual review required',siteReachability:'live verification required',ssl:'live verification required',siteOwnership:'publisher meta present',europeanConsent:'account/CMP configuration required'}
};
fs.writeFileSync('adsense-readiness.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(blocking.length)process.exit(1);
