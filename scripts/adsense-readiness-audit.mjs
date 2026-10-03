import fs from 'node:fs';
import path from 'node:path';

const SITE="https://tawazon-health.vercel.app";
const KIND="tawazon";
const PUBLISHER='ca-pub-1304668609520202';
const ROOT=fs.existsSync('dist')?path.resolve('dist'):path.resolve('.');
const critical=[];
const warnings=[];
const external=[];

function walk(dir){
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
    const full=path.join(dir,entry.name);
    if(entry.name.startsWith('.')||entry.name==='node_modules') return [];
    return entry.isDirectory()?walk(full):[full];
  });
}
function read(file){return fs.readFileSync(file,'utf8');}
function hasAdSense(html){return html.includes('pagead2.googlesyndication.com/pagead/js/adsbygoogle.js');}
function hasPublisherMeta(html){return html.includes('google-adsense-account')&&html.includes(PUBLISHER);}
function isNoindex(html){return /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html);}
function routeOf(file){
  const rel=path.relative(ROOT,file).replaceAll(path.sep,'/');
  if(rel==='index.html') return '/';
  if(rel.endsWith('/index.html')) return '/'+rel.slice(0,-'/index.html'.length);
  return '/'+rel.replace(/\.html$/,'');
}
function isContent(route){
  if(KIND==='jadwa') return route==='/'||route.startsWith('/blog')||route.startsWith('/guides');
  if(KIND==='muwathaq') return route==='/'||route==='/guide'||route.startsWith('/guides');
  return route==='/'||route==='/library'||route==='/library.html'||route.startsWith('/article-')||route.startsWith('/topic-');
}
function isNonContent(route){
  return /^(\/privacy|\/terms|\/contact|\/about|\/editorial|\/disclaimer|\/tools|\/generator|\/analyze|\/login|\/account|\/documents|\/activate|\/create|\/checkout|\/payment|\/404)/.test(route);
}

function directAdScript(html){
  return /<script[^>]+src=["']https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client=[^"']+["'][^>]*>/i.test(html);
}
function conditionalAdScript(html){
  return html.includes('document.createElement("script")') && html.includes('pagead2.googlesyndication.com/pagead/js/adsbygoogle.js');
}
function conditionalAdApplies(html,route){
  if(!conditionalAdScript(html)) return false;
  if(KIND==='jadwa') return route==='/' || route.startsWith('/blog/') || route.startsWith('/guides/');
  if(KIND==='muwathaq') return route==='/' || route==='/guide' || route.startsWith('/guides/');
  return false;
}
const htmlFiles=walk(ROOT).filter(file=>file.endsWith('.html'));
const adRoutes=[];
for(const file of htmlFiles){
  const html=read(file);
  const route=routeOf(file);
  const direct=directAdScript(html);
  const conditional=conditionalAdApplies(html,route);
  const effective=direct || conditional;
  if(effective) {
    adRoutes.push(route);
    if(!isContent(route)||isNonContent(route)) critical.push('Effective AdSense on non-content/utility page: '+route);
  } else if((direct||conditionalAdScript(html)) && (isContent(route)&&!isNonContent(route))){
    // The shared SPA shell may contain a dormant conditional loader; this is not an active ad placement on this route.
  }
}

const verified=htmlFiles.filter(file=>hasPublisherMeta(read(file))||read(file).includes(PUBLISHER));
if(!verified.length) critical.push('AdSense publisher ID/meta not found in generated HTML.');

const adsFiles=[path.join(ROOT,'ads.txt'),path.resolve('ads.txt')].filter((file,i,array)=>fs.existsSync(file)&&fs.statSync(file).isFile()&&array.indexOf(file)===i);
if(!adsFiles.length){
  critical.push('ads.txt not found in deployed/source root.');
}else{
  const adsText=adsFiles.map(read).join('\n');
  const expected='google.com, '+PUBLISHER.replace(/^ca-/i,'')+', DIRECT, f08c47fec0942fa0';
  if(!adsText.includes(expected)) critical.push('ads.txt missing expected publisher authorization line.');
}

const privacyFiles=htmlFiles.filter(file=>/(^|\/)privacy(?:\/index)?\.html$/i.test(file)||/\/privacy\.html$/i.test(file));
if(!privacyFiles.length) critical.push('Privacy policy page not found.');
else{
  const privacy=read(privacyFiles[0]);
  if(!/Google/i.test(privacy)) critical.push('Privacy policy does not mention Google advertising.');
  if(!/ملفات تعريف الارتباط|cookies/i.test(privacy)) critical.push('Privacy policy does not disclose cookies.');
  if(!/myadcenter\.google\.com|مركز إعلانات Google|Ads Settings/i.test(privacy)) critical.push('Privacy policy lacks Google ad personalization opt-out information.');
  if(!/aboutads\.info/i.test(privacy)) critical.push('Privacy policy lacks third-party ad opt-out reference.');
}

const robotsFiles=[path.join(ROOT,'robots.txt'),path.resolve('robots.txt')].filter((file,i,array)=>fs.existsSync(file)&&array.indexOf(file)===i);
if(robotsFiles.length){
  const robots=read(robotsFiles[0]).toLowerCase();
  if(!robots.includes(('sitemap: '+SITE+'/sitemap.xml').toLowerCase())) warnings.push('robots.txt does not expose canonical sitemap URL.');
  if(/disallow:\s*\/\s*$/mi.test(robots)) critical.push('robots.txt blocks the entire site.');
}else{
  critical.push('robots.txt not found.');
}

const cmpPatterns=/googlefc|fundingchoicesmessages|__tcfapi|onetrust|consentmanager/i;
const cmpDetected=htmlFiles.some(file=>cmpPatterns.test(read(file)));
if(!cmpDetected&&adRoutes.length){
  external.push('No detectable Google-certified CMP/TCF implementation in repository output. Configure Privacy & Messaging or another Google-certified TCF CMP before serving personalized ads to EEA/UK/Switzerland traffic.');
}

const report={
  generatedAt:new Date().toISOString(),
  site:SITE,
  publisherId:PUBLISHER,
  adScriptPages:adRoutes.length,
  adScriptRoutes:adRoutes,
  adsTxtPresent:adsFiles.length>0,
  privacyPolicyPresent:privacyFiles.length>0,
  publisherVerificationDetected:verified.length>0,
  cmpDetected,
  critical,
  warnings,
  external
};
fs.writeFileSync('adsense-readiness.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(critical.length) process.exitCode=1;
