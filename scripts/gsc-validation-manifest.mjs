import fs from 'node:fs';
const input=process.argv[2]||'sitemap.xml';
const output=process.argv[3]||'gsc-validation-manifest.json';
const xml=fs.readFileSync(input,'utf8');
const urls=[...xml.split('<loc>').slice(1)].map(x=>x.split('</loc>')[0].trim()).filter(Boolean);
const rows=urls.map((url,index)=>{const path=new URL(url).pathname;let type='content';if(path==='/')type='homepage';else if(path.includes('/article-'))type='article';else if(path.includes('/topic-'))type='topic';else if(path.includes('/tools'))type='tool';else if(path.includes('/library'))type='hub';return {order:index+1,url,type,expected_google_state:'indexable',inspection_action:'Inspect live URL and compare Google-selected canonical',request_indexing:'Only after live inspection confirms canonical/indexability'};});
fs.writeFileSync(output,JSON.stringify({generated_at:new Date().toISOString(),count:rows.length,urls:rows},null,2));
console.log('Generated '+output+' with '+rows.length+' URLs');
