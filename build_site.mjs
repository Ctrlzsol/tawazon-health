// IndexNow key is served from public assets
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const articles=JSON.parse(fs.readFileSync(path.join(ROOT,'content.json'),'utf8'));
const BASE='https://tawazon-health.vercel.app';
const PUBLISHER='ca-pub-1304668609520202';
const CATEGORIES={
 nutrition:{name:'التغذية',icon:'🥗',desc:'الغذاء المتوازن، المكونات والملصقات'},
 weight:{name:'الوزن والحميات',icon:'⚖️',desc:'نزول وزن واقعي وفهم الحميات الشائعة'},
 movement:{name:'الحركة',icon:'🏃',desc:'المشي والقوة وتقليل الخمول'},
 sleep:{name:'النوم',icon:'🌙',desc:'روتين النوم والطاقة والإيقاع اليومي'},
 digestion:{name:'الهضم',icon:'🌿',desc:'الألياف والإمساك وصحة الأمعاء'},
 supplements:{name:'المكملات',icon:'💊',desc:'الاستخدام الآمن للفيتامينات والمكملات'}
};
for(const legacy of ['articles','topics'])if(fs.existsSync(path.join(ROOT,legacy)))fs.rmSync(path.join(ROOT,legacy),{recursive:true,force:true});

const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ads=`<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${PUBLISHER}" crossorigin="anonymous"></script>`;
const analytics='<script defer src="/_vercel/insights/script.js"></script><script async src="https://www.googletagmanager.com/gtag/js?id=G-VZ1DBESBT3"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag("js",new Date());gtag("config","G-VZ1DBESBT3",{send_page_view:true});document.addEventListener("click",function(e){var t=e.target.closest("a,button");if(!t)return;var h=t.getAttribute("href")||"";if(t.hasAttribute("onclick")&&/^calc/.test(t.getAttribute("onclick")))gtag("event","tool_use",{site_name:"tawazon",tool_name:t.textContent.trim().slice(0,60)});else if(h.startsWith("/article-"))gtag("event","select_content",{content_type:"health_article",item_id:h});});</script>';
function shell(title,description,body,canonical,schema='',ogType='website',ogImage=BASE+'/social-card.svg'){
return `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="google-site-verification" content="510SxHdWJd8ZPO7TIe2EBLpG772J315AHp5WEtiJBRI"><meta name="google-site-verification" content="beSz96gFB1TL9aSgmemG8sfr4MbyrISjvNI-6TOKveU"><meta name="msvalidate.01" content="DF9B5905E5498EAA876B1E05B99BE5AD">
<title>${esc(title)}</title><meta name="description" content="${esc(description)}"><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="${canonical}">
<meta property="og:type" content="${ogType}"><meta property="og:locale" content="ar_AR"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${ogImage}"><meta name="twitter:card" content="summary_large_image"><meta name="theme-color" content="#0b1612">
<link rel="icon" href="/logo.svg"><link rel="alternate" type="application/rss+xml" title="مقالات توازن" href="/feed.xml"><link rel="stylesheet" href="/style.css">${ads}${analytics}${schema}<meta name="author" content="فريق توازن التحريري"><meta property="og:site_name" content="توازن"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}"><meta name="twitter:image" content="${ogImage}"><link rel="alternate" hreflang="ar" href="${canonical}"><link rel="preconnect" href="https://images.unsplash.com" crossorigin><link rel="preconnect" href="https://pagead2.googlesyndication.com" crossorigin></head><body><a class="skip-link" href="#main">انتقل إلى المحتوى</a>
<header class="topbar"><a class="brand" href="/"><span class="brand-mark" aria-hidden="true">◒</span><span>توازن<small>مساحة لحياة أفضل</small></span></a><button class="menu" aria-label="فتح القائمة" aria-controls="navigation" aria-expanded="false">☰</button><nav id="navigation" aria-label="القائمة الرئيسية"><a href="/">الرئيسية</a><a href="/library.html">المكتبة الصحية</a><a href="/tools.html">الحاسبات الصحية</a><a href="/tools-calories.html">حاسبة السعرات</a><a href="/tools-bmi.html">حاسبة BMI</a><a href="/#paths">اكتشف المسارات</a><a href="/editorial.html">منهجنا</a></nav><a class="nav-pill header-cta" href="/library.html">ابحث عن إجابتك <span>⌕</span></a></header>
<main id="main">${body}</main><footer><div><a class="brand foot" href="/"><span class="brand-mark" aria-hidden="true">◒</span><span>توازن<small>مساحة لحياة أفضل</small></span></a><p>محتوى صحي عربي هادئ، موثّق، وقابل للتطبيق.</p></div><div class="footer-links"><a href="/about.html">عن الموقع</a><a href="/editorial.html">السياسة التحريرية</a><a href="/privacy.html">الخصوصية</a><a href="/disclaimer.html">إخلاء المسؤولية</a></div><p class="copyright">© 2026 توازن. المعلومات للتثقيف ولا تستبدل الرعاية الطبية.</p></footer><script src="/app.js" defer></script></body></html>`}

const photos={nutrition:'photo-1512621776951-a57141f2eefd',weight:'photo-1490645935967-10de6ba17061',movement:'photo-1476480862126-209bfaa8edc8',sleep:'photo-1505693416388-ac5ce068fe85',digestion:'photo-1540420773420-3366772f4999',supplements:'photo-1611080626919-7cf5a9dbab5b'};
const photo=(category,width=800)=>`https://images.unsplash.com/${photos[category]||photos.nutrition}?auto=format&fit=crop&w=${width}&q=85`;
const symbols={nutrition:'◒',weight:'◎',movement:'↗',sleep:'☾',digestion:'❧',supplements:'✳'};
const card=a=>`<a class="article-card" data-category="${a.category}" data-search="${esc(a.title+' '+a.description+' '+a.kicker)}" href="/article-${a.slug}.html"><div class="card-media"><img src="${photo(a.category)}" alt="${esc(a.title)}" width="800" height="560" loading="lazy"><span class="category-tag">${CATEGORIES[a.category].name}</span></div><div class="card-body"><div class="eyebrow">دليل توازن <span>·</span> ${a.read} قراءة</div><h3>${a.title}</h3><p>${a.description}</p><span class="read-more">اقرأ المقال <b>↖</b></span></div></a>`;
const picks=['calories-guide','belly-fat','protein-basics','walking-after-meals','better-sleep','magnesium-basics'].map(slug=>articles.find(a=>a.slug===slug));
let home=`<section class="hero"><div class="hero-copy"><div class="status"><i></i> صحتك، ببساطة ووعي</div><h1>حياة أكثر توازناً.<br><span>تبدأ بخطوة صغيرة.</span></h1><p>مساحتك لفهم صحتك بعيداً عن الضجيج.<br>أدلة عربية واضحة في التغذية والحركة والنوم،<br class="desktop-break"> لتختار ما يناسبك وتبني عادات تدوم.</p><div class="hero-actions"><a class="primary" href="/library.html">اكتشف المكتبة <b>←</b></a><a class="ghost" href="/editorial.html">تعرّف على توازن ↗</a></div><div class="hero-proof"><span class="proof-mark">✓</span><span>معرفة تستند إلى مصادر صحية موثوقة<small>محتوى للتثقيف، يضع صحتك أولاً.</small></span></div></div><div class="hero-image"><img src="${photo('nutrition',1400)}" alt="طبق ملون من الخضروات الطازجة ضمن غذاء متنوع" width="1400" height="1400" fetchpriority="high"><span class="image-note">غذاء بسيط. عادات أفضل.</span><div class="floating-note"><span>❧</span><div><b>التوازن أسلوب حياة</b><small>ابدأ بما تستطيع، واستمر بطريقتك.</small></div></div></div></section>
<section class="trust-strip" aria-label="مصادر المحتوى"><span>المعرفة تبدأ من مصدر موثوق</span><div><b>WHO</b><small>منظمة الصحة العالمية</small></div><div><b>NIH</b><small>معاهد الصحة الوطنية</small></div><div><b>CDC</b><small>مراكز مكافحة الأمراض</small></div><a href="/editorial.html">كيف نختار مصادرنا؟ ↗</a></section>
<section class="path-section" id="paths"><div class="section-head"><div><span class="section-no">مساحة لكل جانب من صحتك</span><h2>ما الذي يشغلك اليوم؟</h2></div><p>اختر مسارك، وابدأ من السؤال الأقرب إليك.</p></div><div class="paths">${Object.entries(CATEGORIES).map(([slug,c])=>`<a href="/topic-${slug}.html"><span class="path-icon">${symbols[slug]}</span><b>${c.name}</b><small>${articles.filter(a=>a.category===slug).length} أدلة مبسّطة</small><i>←</i></a>`).join('')}</div></section>
<section class="section latest" id="latest"><div class="section-head"><div><span class="section-no">اخترنا لك</span><h2>معرفة تفيدك في يومك.</h2></div><a class="text-link" href="/library.html">كل المقالات <span>←</span></a></div><div class="articles-grid">${picks.map(card).join('')}</div></section>
<section class="feature"><div class="feature-photo"><img src="${photo('weight',1100)}" alt="مكونات طازجة ومتنوعة لتحضير وجبة متوازنة" loading="lazy" width="1100" height="850"></div><div class="feature-copy"><span class="section-no">قراءة تستحق وقتك</span><h2>الأكل الصحي.<br>مرونة أكثر،<br><em>تعقيد أقل.</em></h2><p>تعرّف إلى نمط البحر المتوسط، وكيف تبني وجبات متنوعة من أطعمة بسيطة ومتاحة.</p><a class="primary" href="/article-mediterranean-pattern.html">اقرأ الدليل <b>←</b></a></div></section>
<section class="manifesto"><div><span class="section-no">وعد توازن</span><h2>نفهم الدليل.<br>ونقرّب المعلومة.</h2><a class="text-link" href="/editorial.html">اقرأ سياستنا التحريرية ←</a></div><div class="principles"><div><span>01</span><h3>مصادر واضحة</h3><p>روابط للمصادر الصحية في نهاية كل مقال، لتقرأ وتتحقق بنفسك.</p></div><div><span>02</span><h3>خطوات واقعية</h3><p>أفكار صغيرة قابلة للتطبيق، تراعي اختلاف حياتنا واحتياجاتنا.</p></div><div><span>03</span><h3>صحتك أولاً</h3><p>نوضح حدود المعلومة ومتى تحتاج إلى استشارة المختص.</p></div></div></section>`;
const webSchema=`<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'WebSite',name:'توازن',url:BASE+'/',inLanguage:'ar',description:'محتوى صحي عربي موثوق عن التغذية والحركة والنوم.'})}</script>`;
fs.writeFileSync(path.join(ROOT,'index.html'),shell('توازن | صحة يومية بلا تعقيد','مقالات عربية موثوقة عن التغذية والكيتو وخسارة الوزن والحركة والنوم، بلغة واضحة وخطوات عملية.',home,BASE+'/',webSchema));

for(const a of articles){
 const toc=a.sections.map(([h],i)=>`<a href="#s${i+1}">${esc(h)}</a>`).join('');
 const sections=a.sections.map(([h,p],i)=>`<section id="s${i+1}"><span class="chapter">0${i+1}</span><h2>${esc(h)}</h2><p>${esc(p)}</p></section>`).join('');
 const sources=a.sources.map(([name,url])=>`<li><a href="${url}" rel="noopener noreferrer" target="_blank">${esc(name)} ↗</a></li>`).join('');
 const related=articles.filter(x=>x.slug!==a.slug&&x.category===a.category).slice(0,3).map(x=>`<a href="/article-${x.slug}.html"><span aria-hidden="true">↖</span><b>${x.title}</b></a>`).join('');
 const body=`<article class="article"><header class="article-hero ${a.accent}"><a class="back" href="/">الرئيسية / المقالات</a><div class="article-meta">${a.kicker} <i></i> ${a.read} <i></i> مراجعة: ${a.date}</div><h1>${a.title}</h1><p>${a.description}</p><img class="article-cover" src="${photo(a.category,1200)}" alt="${esc(a.title)}" width="1200" height="650" fetchpriority="high"></header><div class="article-layout"><aside><b>في هذا الدليل</b>${toc}<div class="doctor-note">إذا كنت تستخدم دواءً أو لديك حالة مزمنة، راجع مختصاً قبل تغيير كبير.</div></aside><div class="article-content"><p class="lead">${a.intro}</p><div class="share-strip" aria-label="مشاركة المقال"><span>شارك الدليل</span><a href="https://wa.me/?text=${encodeURIComponent(a.title+" — "+BASE+"/article-"+a.slug+".html")}" target="_blank" rel="noopener noreferrer">واتساب</a><a href="https://t.me/share/url?url=${encodeURIComponent(BASE+"/article-"+a.slug+".html")}&text=${encodeURIComponent(a.title)}" target="_blank" rel="noopener noreferrer">Telegram</a><a href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(BASE+"/article-"+a.slug+".html")}" target="_blank" rel="noopener noreferrer">LinkedIn</a><a href="https://x.com/intent/post?text=${encodeURIComponent(a.title)}&url=${encodeURIComponent(BASE+"/article-"+a.slug+".html")}" target="_blank" rel="noopener noreferrer">X</a></div>${sections}<div class="sources"><h2>المصادر</h2><p>مصادر صحية رسمية استُخدمت للتحقق من المبادئ العامة:</p><ul>${sources}</ul></div></div></div></article><section class="more"><span>اقرأ أيضاً</span><div>${related}</div></section>`;
 const schema='<script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@type':'Article',headline:a.title,description:a.description,image:[photo(a.category,1200)],datePublished:a.date,dateModified:a.date,inLanguage:'ar',articleSection:CATEGORIES[a.category].name,keywords:[a.kicker,CATEGORIES[a.category].name,'توازن'],author:{'@type':'Organization',name:'فريق توازن التحريري'},publisher:{'@type':'Organization',name:'توازن'},citation:a.sources.map(function(x){return x[1]}),mainEntityOfPage:BASE+'/article-'+a.slug+'.html'})+'</script>'+'<script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'الرئيسية',item:BASE+'/'},{'@type':'ListItem',position:2,name:CATEGORIES[a.category].name,item:BASE+'/topic-'+a.category+'.html'},{'@type':'ListItem',position:3,name:a.title,item:BASE+'/article-'+a.slug+'.html'}]})+'</script>';
 fs.writeFileSync(path.join(ROOT,`article-${a.slug}.html`),shell(`${a.title} | توازن`,a.description,body,`${BASE}/article-${a.slug}.html`,schema,'article',photo(a.category,1200)));
}

const filterButtons=`<button class="filter active" data-filter="all">الكل <b>${articles.length}</b></button>`+Object.entries(CATEGORIES).map(([slug,c])=>`<button class="filter" data-filter="${slug}">${c.name} <b>${articles.filter(a=>a.category===slug).length}</b></button>`).join('');
const libraryBody=`<section class="library-hero"><span>مكتبة توازن</span><h1>إجابة واضحة<br>لسؤال صحي شائع.</h1><p>${articles.length} دليلاً عربياً في ستة مسارات، مع مصادر رسمية وتاريخ مراجعة واضح.</p><label class="search-box"><span>⌕</span><input aria-label="ابحث في المقالات" id="article-search" type="search" placeholder="ابحث: الألياف، النوم، المشي..." autocomplete="off"></label></section><section class="library-wrap"><div class="filters" aria-label="تصفية المقالات">${filterButtons}</div><p id="results-count" aria-live="polite" class="results-count">عرض ${articles.length} مقالاً</p><div id="library-grid" class="articles-grid library-grid">${articles.map(card).join('')}</div><div id="empty-state" class="empty-state" hidden><b>لا توجد نتيجة مطابقة</b><p>جرّب كلمة أقصر أو اختر مساراً آخر.</p></div></section>`;
const librarySchema='<script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@type':'CollectionPage',name:'المكتبة الصحية | توازن',description:'مكتبة عربية صحية موثقة عن التغذية والوزن والحركة والنوم والهضم والمكملات.',url:BASE+'/library.html',inLanguage:'ar',mainEntity:{'@type':'ItemList',numberOfItems:articles.length,itemListElement:articles.map(function(a,i){return {'@type':'ListItem',position:i+1,name:a.title,url:BASE+'/article-'+a.slug+'.html'}})}})+'</script>';
fs.writeFileSync(path.join(ROOT,'library.html'),shell(`المكتبة الصحية | توازن`,`مكتبة عربية تضم ${articles.length} دليلاً موثقاً عن التغذية والوزن والحركة والنوم والهضم والمكملات.`,libraryBody,`${BASE}/library.html`,librarySchema));
for(const [slug,c] of Object.entries(CATEGORIES)){
 const list=articles.filter(a=>a.category===slug);
 const body=`<section class="topic-hero"><span>مسار توازن / ${c.name}</span><h1>${c.name}</h1><p>${c.desc}. اقرأ الأدلة بترتيب يناسب سؤالك، وارجع إلى المصادر في نهاية كل مقال.</p><a class="ghost" href="/library.html">← جميع المسارات</a></section><section class="section"><div class="section-head"><div><span class="section-no">${list.length} أدلة</span><h2>في هذا المسار</h2></div></div><div class="articles-grid">${list.map(card).join('')}</div></section>`;
 const topicSchema='<script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@type':'CollectionPage',name:c.name+' | توازن',description:c.desc,url:BASE+'/topic-'+slug+'.html',inLanguage:'ar',mainEntity:{'@type':'ItemList',numberOfItems:list.length,itemListElement:list.map(function(a,i){return {'@type':'ListItem',position:i+1,name:a.title,url:BASE+'/article-'+a.slug+'.html'}})}})+'</script>';
 fs.writeFileSync(path.join(ROOT,`topic-${slug}.html`),shell(`${c.name} | توازن`,c.desc,body,`${BASE}/topic-${slug}.html`,topicSchema));
}


const toolsBody=`
<section class="page-hero">
  <span>أدوات توازن</span>
  <h1>حاسبات صحية<br>بسيطة وواضحة.</h1>
  <p>أدوات تقديرية للتثقيف وفهم الأرقام، وليست بديلاً عن التقييم الطبي أو اختصاصي التغذية.</p>
</section>
<section class="section tools-grid">
  <div class="tool-card">
    <span class="section-no">01 · مؤشر كتلة الجسم</span>
    <h2>حاسبة BMI</h2>
    <p>أدخل الطول والوزن للحصول على مؤشر كتلة الجسم مع شرح مبسط لحدوده.</p>
    <div class="tool-form">
      <label>الطول بالسنتيمتر<input id="bmi-height" type="number" min="80" max="250" inputmode="decimal" placeholder="170"></label>
      <label>الوزن بالكيلوغرام<input id="bmi-weight" type="number" min="20" max="400" inputmode="decimal" placeholder="70"></label>
      <button class="primary" type="button" onclick="calcBMI()">احسب الآن</button>
      <output id="bmi-result" class="tool-result" aria-live="polite"></output>
    </div>
  </div>
  <div class="tool-card">
    <span class="section-no">02 · احتياج الطاقة</span>
    <h2>حاسبة السعرات اليومية</h2>
    <p>تقدير تقريبي مبني على العمر والطول والوزن والجنس والنشاط، لا وصفة علاجية.</p>
    <div class="tool-form">
      <label>العمر<input id="cal-age" type="number" min="15" max="100" placeholder="30"></label>
      <label>الجنس<select id="cal-sex"><option value="male">ذكر</option><option value="female">أنثى</option></select></label>
      <label>الطول بالسنتيمتر<input id="cal-height" type="number" min="120" max="230" placeholder="175"></label>
      <label>الوزن بالكيلوغرام<input id="cal-weight" type="number" min="30" max="300" placeholder="80"></label>
      <label>النشاط<select id="cal-activity"><option value="1.2">قليل الحركة</option><option value="1.375">نشاط خفيف</option><option value="1.55">نشاط متوسط</option><option value="1.725">نشاط مرتفع</option><option value="1.9">نشاط مرتفع جداً</option></select></label>
      <button class="primary" type="button" onclick="calcCalories()">قدّر احتياجك</button>
      <output id="cal-result" class="tool-result" aria-live="polite"></output>
    </div>
  </div>
</section>
<section class="prose">
  <h2>كيف نستخدم الحاسبات؟</h2>
  <p>هذه النتائج تقديرية. مؤشر كتلة الجسم لا يفرّق بين كتلة العضلات والدهون، وحساب السعرات لا يلتقط كل الفروق الفردية. استخدم النتائج كنقطة بداية لفهم العادات، وليس كرقم إلزامي.</p>
  <h2>مصادر مفيدة</h2>
  <p><a href="https://www.niddk.nih.gov/health-information/weight-management/body-weight-planner" target="_blank" rel="noopener noreferrer">NIDDK: مخطط وزن الجسم ↗</a></p>
  <p><a href="https://www.niddk.nih.gov/health-information/weight-management/adult-overweight-obesity" target="_blank" rel="noopener noreferrer">NIDDK: الوزن الصحي وإدارة الوزن ↗</a></p>
</section>
<script>
function calcBMI(){
  const h=Number(document.getElementById('bmi-height').value);
  const w=Number(document.getElementById('bmi-weight').value);
  const out=document.getElementById('bmi-result');
  if(!(h>0&&w>0)){out.textContent='أدخل الطول والوزن.';return;}
  const bmi=w/((h/100)*(h/100));
  let label=bmi<18.5?'أقل من النطاق المرجعي للبالغين':bmi<25?'ضمن النطاق المرجعي للبالغين':bmi<30?'أعلى من النطاق المرجعي للبالغين':'30 أو أكثر';
  out.textContent='BMI = '+bmi.toFixed(1)+' — '+label+'.';
}
function calcCalories(){
  const age=Number(document.getElementById('cal-age').value);
  const h=Number(document.getElementById('cal-height').value);
  const w=Number(document.getElementById('cal-weight').value);
  const sex=document.getElementById('cal-sex').value;
  const act=Number(document.getElementById('cal-activity').value);
  const out=document.getElementById('cal-result');
  if(!(age>0&&h>0&&w>0)){out.textContent='أكمل البيانات أولاً.';return;}
  const bmr=(10*w)+(6.25*h)-(5*age)+(sex==='male'?5:-161);
  const tdee=Math.round(bmr*act);
  out.textContent='التقدير التقريبي للمحافظة على الوزن: نحو '+tdee.toLocaleString('ar-JO')+' سعرة يومياً.';
}
</script>`;
fs.writeFileSync(path.join(ROOT,'tools.html'),shell('الحاسبات الصحية | توازن','حاسبات صحية عربية لتقدير مؤشر كتلة الجسم واحتياج الطاقة، مع شرح للنتائج وحدودها.',toolsBody,BASE+'/tools.html'));


const bmiPageBody=`
<section class="page-hero"><span>حاسبة توازن</span><h1>حاسبة مؤشر كتلة الجسم BMI</h1><p>احسب مؤشر كتلة الجسم للبالغين بسرعة، ثم اقرأ حدود المؤشر قبل تفسير النتيجة.</p></section>
<section class="prose"><div class="tool-card"><h2>أدخل بياناتك</h2><div class="tool-form"><label>الطول بالسنتيمتر<input id="bmi-height" type="number" min="80" max="250" placeholder="170"></label><label>الوزن بالكيلوغرام<input id="bmi-weight" type="number" min="20" max="400" placeholder="70"></label><button class="primary" type="button" onclick="calcBMIPage()">احسب BMI</button><output id="bmi-page-result" class="tool-result" aria-live="polite"></output></div></div>
<h2>ما معنى النتيجة؟</h2><p>مؤشر كتلة الجسم أداة فرز عامة للبالغين، وليس تشخيصاً ولا يفرّق وحده بين كتلة العضلات والدهون. استخدم النتيجة مع بقية الصورة الصحية.</p>
<h2>قراءة مفيدة بعد الحساب</h2><p><a href="/article-healthy-weight-loss.html">خسارة الوزن بلا قسوة ↗</a> · <a href="/article-belly-fat.html">دهون البطن ↗</a> · <a href="/topic-weight.html">مسار الوزن والحميات ↗</a></p>
<p class="seo-note">هذه الحاسبة للتثقيف العام. عند وجود مرض مزمن أو تغير كبير في الوزن، ناقش النتائج مع مختص.</p></section>
<script>function calcBMIPage(){const h=Number(document.getElementById('bmi-height').value),w=Number(document.getElementById('bmi-weight').value),o=document.getElementById('bmi-page-result');if(!(h>0&&w>0)){o.textContent='أدخل الطول والوزن.';return;}const b=w/((h/100)*(h/100));o.textContent='BMI = '+b.toFixed(1);}</script>`;
fs.writeFileSync(path.join(ROOT,'tools-bmi.html'),shell('حاسبة BMI ومؤشر كتلة الجسم | توازن','حاسبة مؤشر كتلة الجسم BMI للبالغين مع شرح للنتيجة وحدود استخدامها.',bmiPageBody,BASE+'/tools-bmi.html'));

const caloriePageBody=`
<section class="page-hero"><span>حاسبة توازن</span><h1>حاسبة السعرات الحرارية اليومية</h1><p>قدّر احتياجك التقريبي من السعرات للمحافظة على الوزن بناءً على العمر والطول والوزن ومستوى النشاط.</p></section>
<section class="prose"><div class="tool-card"><h2>أدخل بياناتك</h2><div class="tool-form"><label>العمر<input id="c-age" type="number" min="15" max="100" placeholder="30"></label><label>الجنس<select id="c-sex"><option value="male">ذكر</option><option value="female">أنثى</option></select></label><label>الطول بالسنتيمتر<input id="c-height" type="number" min="120" max="230" placeholder="175"></label><label>الوزن بالكيلوغرام<input id="c-weight" type="number" min="30" max="300" placeholder="80"></label><label>النشاط<select id="c-act"><option value="1.2">قليل الحركة</option><option value="1.375">نشاط خفيف</option><option value="1.55">نشاط متوسط</option><option value="1.725">نشاط مرتفع</option><option value="1.9">نشاط مرتفع جداً</option></select></label><button class="primary" type="button" onclick="calcCalPage()">احسب السعرات</button><output id="c-result" class="tool-result" aria-live="polite"></output></div></div>
<h2>كيف تستخدم الرقم؟</h2><p>التقدير نقطة بداية لفهم احتياج الطاقة، وليس رقماً علاجياً ثابتاً. اختلاف النشاط والحالة الصحية والأدوية يمكن أن يغيّر الاحتياج الفعلي.</p>
<h2>اقرأ أيضاً</h2><p><a href="/article-calories-guide.html">السعرات الحرارية: كيف تعرف احتياجك اليومي؟ ↗</a> · <a href="/article-healthy-weight-loss.html">خسارة الوزن بلا قسوة ↗</a> · <a href="/topic-weight.html">مسار الوزن والحميات ↗</a></p>
<p class="seo-note">هذه الحاسبة للتثقيف العام. لا تستخدمها لتحديد علاج أو جرعة أو خطة خاصة دون مختص عند وجود حالة صحية.</p></section>
<script>function calcCalPage(){const age=Number(document.getElementById('c-age').value),h=Number(document.getElementById('c-height').value),w=Number(document.getElementById('c-weight').value),sex=document.getElementById('c-sex').value,a=Number(document.getElementById('c-act').value),o=document.getElementById('c-result');if(!(age>0&&h>0&&w>0)){o.textContent='أكمل البيانات أولاً.';return;}const b=(10*w)+(6.25*h)-(5*age)+(sex==='male'?5:-161);o.textContent='التقدير التقريبي: '+Math.round(b*a).toLocaleString('ar-JO')+' سعرة يومياً.';}</script>`;
fs.writeFileSync(path.join(ROOT,'tools-calories.html'),shell('حاسبة السعرات الحرارية اليومية | توازن','حاسبة عربية لتقدير احتياج السعرات اليومية حسب العمر والطول والوزن والنشاط.',caloriePageBody,BASE+'/tools-calories.html'));

const pages={
 'about.html':['عن توازن','منصة محتوى صحي عربي تضع الوضوح والمصادر والسياق قبل الوعود السريعة.',`<section class="page-hero"><span>عن توازن</span><h1>المعلومة الصحية<br>تستحق الهدوء.</h1><p>توازن موقع تثقيفي عربي يشرح موضوعات التغذية والحركة والنوم بلغة واضحة. لا نبيع حلولاً سحرية ولا نشخّص الحالات الطبية.</p></section><section class="prose"><h2>ما الذي نقدمه؟</h2><p>أدلة عملية تبدأ من المصادر الصحية الرسمية، وتوضح حدود المعلومة ومن يحتاج إلى استشارة مختص. نكتب للقارئ الذي يريد فهماً أفضل قبل اتخاذ قرار.</p><h2>من يكتب المحتوى؟</h2><p>يعد فريق التحرير المسودة ويقارن الادعاءات بالمصادر المذكورة في نهاية كل مقال. عند تناول إرشاد شخصي أو حالة مرضية، نوجّه القارئ إلى الطبيب أو اختصاصي التغذية المرخّص.</p><h2>تواصل</h2><p>سيضاف بريد التواصل الرسمي عند ربط النطاق.</p></section>`],
 'editorial.html':['السياسة التحريرية','كيف يختار توازن مصادره ويراجع محتواه الصحي ويصحح الأخطاء.',`<section class="page-hero"><span>السياسة التحريرية</span><h1>مصدر واضح.<br>ادعاء محسوب.</h1><p>نستخدم مصادر صحية رسمية وبحوثاً محكمة، ونميّز بين الإرشادات العامة والرعاية الفردية.</p></section><section class="prose"><h2>اختيار الموضوع</h2><p>نختار الأسئلة الشائعة التي يمكن شرحها بأمان، ونبتعد عن التشخيص والوصفات الدوائية الفردية. العناوين لا تعد بنتيجة مضمونة.</p><h2>المصادر والمراجعة</h2><p>تعتمد المقالات على جهات صحية رسمية مثل منظمة الصحة العالمية وNIDDK وCDC، وتعرض روابطها في نهاية المقال. نراجع المحتوى عند ظهور إرشادات جديدة، ونضع تاريخ المراجعة بوضوح.</p><h2>التصحيح</h2><p>إذا ظهر خطأ مؤثر، نصححه ونحدّث تاريخ المراجعة.</p><h2>الإعلانات والاستقلال</h2><p>قد يعرض الموقع إعلانات بواسطة Google AdSense بعد الموافقة. لا يغيّر المعلنون المحتوى، ولا نخلط الإعلان بالتوصية الصحية.</p></section>`],
 'privacy.html':['سياسة الخصوصية','سياسة الخصوصية وملفات الارتباط والإعلانات في موقع توازن.',`<section class="page-hero compact"><span>الخصوصية</span><h1>خصوصيتك تهمنا.</h1><p>آخر تحديث: 21 سبتمبر 2026</p></section><section class="prose"><h2>البيانات</h2><p>لا يطلب الموقع حالياً إنشاء حساب أو إدخال بيانات صحية. قد تسجل خدمات الاستضافة وGoogle Analytics بيانات تقنية معتادة مثل عنوان IP المختصر ونوع المتصفح والصفحات والزيارات لأغراض الأمان وقياس الأداء وتحسين المحتوى.</p><h2>ملفات الارتباط والإعلانات</h2><p>قد تستخدم Google، بصفتها مورداً خارجياً، ملفات ارتباط لعرض الإعلانات وقياس أدائها بعد موافقة الموقع في AdSense. يمكن إدارة تخصيص الإعلانات من إعدادات إعلانات Google. سنعرض خيارات الموافقة المطلوبة للزوار في المناطق التي تفرض ذلك.</p><h2>الروابط الخارجية</h2><p>تؤدي بعض الروابط إلى مصادر صحية خارجية لها سياسات مستقلة. لا نشارك معلومات طبية شخصية مع هذه الجهات.</p></section>`],
 'disclaimer.html':['إخلاء المسؤولية الصحية','حدود استخدام المحتوى الصحي المنشور في توازن.',`<section class="page-hero compact"><span>إخلاء المسؤولية</span><h1>للتثقيف، لا للتشخيص.</h1><p>المحتوى العام لا يعرف تاريخك الطبي أو أدويتك أو نتائج فحوصك.</p></section><section class="prose"><h2>ليست نصيحة طبية شخصية</h2><p>المعلومات في توازن لأغراض التثقيف العام ولا تستبدل تشخيص الطبيب أو خطة اختصاصي تغذية مرخص. لا تؤخر طلب الرعاية بسبب مقال قرأته هنا.</p><h2>الحالات الطارئة</h2><p>عند ألم الصدر أو صعوبة التنفس أو الإغماء أو ارتباك مفاجئ أو علامات حالة طارئة، اتصل بخدمات الطوارئ المحلية فوراً.</p><h2>الحميات والأدوية</h2><p>قد تؤثر التغييرات الغذائية والصيام في سكر الدم والضغط وجرعات الدواء. الحوامل والمرضعات والأطفال ومن لديهم مرض مزمن أو اضطراب أكل يحتاجون إلى توجيه مهني قبل تغيير كبير.</p></section>`]
};
for(const [file,[title,desc,body]] of Object.entries(pages))fs.writeFileSync(path.join(ROOT,file),shell(`${title} | توازن`,desc,body,`${BASE}/${file}`));
fs.writeFileSync(path.join(ROOT,'ads.txt'),'google.com, pub-1304668609520202, DIRECT, f08c47fec0942fa0\n');
fs.writeFileSync(path.join(ROOT,'robots.txt'),`User-agent: *\nAllow: /\nSitemap: ${BASE}/sitemap.xml\n`);
const urls=['/','/library.html','/tools.html','/tools-calories.html','/tools-bmi.html','/about.html','/editorial.html','/privacy.html','/disclaimer.html',...Object.keys(CATEGORIES).map(c=>`/topic-${c}.html`),...articles.map(a=>`/article-${a.slug}.html`)];
const sitemapRows=urls.map(u=>{const match=articles.find(a=>u==='/article-'+a.slug+'.html');const lastmod=match?(match.date||'2026-09-22'):'2026-09-22';return `  <url><loc>${BASE}${u}</loc><lastmod>${lastmod}</lastmod></url>`;});
fs.writeFileSync(path.join(ROOT,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+sitemapRows.join('\n')+'\n</urlset>\n');
const rssItems=articles.map(a=>`<item><title>${esc(a.title)}</title><link>${BASE}/article-${a.slug}.html</link><guid>${BASE}/article-${a.slug}.html</guid><description>${esc(a.description)}</description><media:content url="${esc(photo(a.category,1200))}" medium="image"/><pubDate>${new Date((a.date||'2026-09-22')+'T08:00:00Z').toUTCString()}</pubDate></item>`).join('');
fs.writeFileSync(path.join(ROOT,'feed.xml'),`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/"><channel><title>توازن</title><link>${BASE}/</link><atom:link rel="self" href="${BASE}/feed.xml" type="application/rss+xml"/><atom:link rel="hub" href="https://pubsubhubbub.appspot.com/"/><description>مقالات عربية موثوقة عن التغذية والحركة والنوم.</description><language>ar</language>${rssItems}</channel></rss>`);
console.log(`Built ${urls.length} indexable pages in ${ROOT}`);
const output=path.join(ROOT,'dist');
fs.mkdirSync(output,{recursive:true});
for(const name of fs.readdirSync(ROOT)){
 if(/\.(html|css|js|svg|xml|txt)$/.test(name))fs.copyFileSync(path.join(ROOT,name),path.join(output,name));
}
const publicDir=path.join(ROOT,'public');
if(fs.existsSync(publicDir)){
 for(const name of fs.readdirSync(publicDir))fs.copyFileSync(path.join(publicDir,name),path.join(output,name));
}
