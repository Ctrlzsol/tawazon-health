import fs from 'node:fs';

const input=process.argv[2];
const output=process.argv[3]||'gsc-validation-manifest.json';
if(!input) throw new Error('Usage: node scripts/gsc-validation-manifest.mjs <sitemap-url-or-file> [output]');

const xml=input.startsWith('http://')||input.startsWith('https://')
  ? await fetch(input,{headers:{'user-agent':'SEO-GSC-Manifest/1.0'}}).then(async r=>{if(!r.ok)throw new Error('Sitemap HTTP '+r.status);return r.text();})
  : fs.readFileSync(input,'utf8');

const urls=[...xml.split('<loc>').slice(1)].map(x=>x.split('</loc>')[0].trim()).filter(Boolean);
const rows=urls.map((url,index)=>{
  const p=new URL(url).pathname;
  let type='content';
  if(p==='/') type='homepage';
  else if(p.includes('/study/')) type='programmatic-study';
  else if(p.includes('/guides/')) type='guide';
  else if(p.includes('/article-')) type='article';
  else if(p.includes('/topic-')) type='topic';
  else if(p.includes('/tools')) type='tool';
  else if(p.includes('/directory')||p==='/guide'||p==='/library.html') type='hub';
  return {
    order:index+1,
    url,
    type,
    expected_google_state:'indexable',
    inspection_action:'Inspect live URL and compare Google-selected canonical',
    request_indexing:'Only after live inspection confirms the page is indexable and canonical is correct'
  };
});
fs.writeFileSync(output,JSON.stringify({generated_at:new Date().toISOString(),sitemap_source:input,count:rows.length,urls:rows},null,2));
console.log('Generated '+output+' with '+rows.length+' URLs');
