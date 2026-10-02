import fs from 'node:fs';

const SITE='https://tawazon-health.vercel.app';
const text=await (await fetch(SITE+'/sitemap.xml')).text();
const urls=[...text.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1].trim());

function priority(url){
  const path=new URL(url).pathname;
  if(path==='/')return 1.0;
  if(/^\/(directory|guide|library|blog|tools|structure)$/.test(path))return 0.95;
  if(path.includes('/study/')||path.includes('/guides/')||path.includes('/article-'))return 0.9;
  if(path.includes('/topic-'))return 0.85;
  return 0.7;
}
function type(url){
  const path=new URL(url).pathname;
  if(path==='/')return 'homepage';
  if(path.includes('/study/'))return 'programmatic-content';
  if(path.includes('/guides/'))return 'guide';
  if(path.includes('/article-')||path.includes('/blog/'))return 'editorial-content';
  if(path.includes('/topic-')||['/directory','/guide','/library','/blog','/tools','/structure'].includes(path))return 'hub';
  return 'utility';
}
const entries=urls.map(url=>({url,type:type(url),priority:priority(url),requiresGscInspection:true}));
const samples=[];
for(const group of ['homepage','hub','programmatic-content','guide','editorial-content','utility']){
  const hit=entries.filter(x=>x.type===group);
  if(hit.length)samples.push(...hit.slice(0,3));
}
const manifest={
  site:SITE,
  generatedAt:new Date().toISOString(),
  purpose:'Prepared manifest for Google Search Console URL Inspection and validation. It does not contain Google indexing state.',
  totalUrls:entries.length,
  entries,
  representativeSamples:[...new Map(samples.map(x=>[x.url,x])).values()]
};
fs.writeFileSync('gsc-indexing-manifest.json',JSON.stringify(manifest,null,2));
console.log('Generated '+entries.length+' GSC inspection candidates for '+SITE);
