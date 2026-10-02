import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve('dist');
const WARN_INITIAL_JS=700*1024;
const WARN_TOTAL_INITIAL_JS=900*1024;
const WARN_HTML=500*1024;
const WARN_ASSET=1024*1024;
const warnings=[];
const errors=[];

function walk(dir){
  if(!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
    const full=path.join(dir,entry.name);
    if(entry.name.startsWith('.')||entry.name==='node_modules')return [];
    return entry.isDirectory()?walk(full):[full];
  });
}
function size(file){return fs.statSync(file).size;}
function htmlFiles(){return walk(ROOT).filter(f=>f.endsWith('.html'));}
function scriptsFrom(html){
  const out=[];
  for(const m of html.matchAll(/<script[^>]+src=["']([^"']+)["'][^>]*>/gi)){
    const src=m[1];
    if(src.startsWith('/')&&!src.startsWith('//'))out.push(src.split('?')[0]);
  }
  return [...new Set(out)];
}
const files=walk(ROOT);
const assets=files.filter(f=>/\.(js|mjs|css|png|jpe?g|webp|svg|woff2?|ttf|otf)$/i.test(f));
const largest=assets.map(f=>({file:path.relative(ROOT,f).replaceAll(path.sep,'/'),bytes:size(f)})).sort((a,b)=>b.bytes-a.bytes);
for(const item of largest){
  if(item.bytes>WARN_ASSET)warnings.push('large asset >1MB: '+item.file+' ('+item.bytes+' bytes)');
}
const htmlReport=[];
for(const file of htmlFiles()){
  const rel=path.relative(ROOT,file).replaceAll(path.sep,'/');
  const bytes=size(file);
  const html=fs.readFileSync(file,'utf8');
  const refs=scriptsFrom(html);
  const initial=refs.map(src=>{
    const disk=path.join(ROOT,src.slice(1));
    return fs.existsSync(disk)?{src,bytes:size(disk)}:null;
  }).filter(Boolean);
  const total=initial.reduce((n,x)=>n+x.bytes,0);
  if(bytes>WARN_HTML)warnings.push('large HTML >500KB: '+rel+' ('+bytes+' bytes)');
  for(const x of initial)if(x.bytes>WARN_INITIAL_JS)warnings.push('large initial JS >700KB: '+rel+' -> '+x.src+' ('+x.bytes+' bytes)');
  if(total>WARN_TOTAL_INITIAL_JS)warnings.push('initial JS total >900KB: '+rel+' ('+total+' bytes)');
  htmlReport.push({page:rel,htmlBytes:bytes,initialJsBytes:total,initialScripts:initial});
}
const result={generatedAt:new Date().toISOString(),htmlPages:htmlReport.length,largestAssets:largest.slice(0,20),warnings,errors};
fs.writeFileSync('seo-performance-audit.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
