(() => {
  'use strict';
  const slot = document.querySelector('[data-adsterra-display]');
  if (!slot || slot.dataset.initialized) return;
  slot.dataset.initialized = 'true';
  const en = document.documentElement.lang === 'en';
  const text = en ? {
    label:'Advertisement', title:'Optional advertising',
    detail:'Allow Adsterra to use cookies and process technical data (such as IP address and browser information) to show and measure ads. You can continue reading without allowing ads.',
    accept:'Allow ads', reject:'No thanks', change:'Change ad preference', privacy:'Adsterra privacy policy',
    preview:'Ad preview — live ads are disabled on preview domains.'
  } : {
    label:'إعلان', title:'إعلانات اختيارية',
    detail:'السماح لـ Adsterra باستخدام ملفات الارتباط ومعالجة بيانات تقنية مثل عنوان IP ومعلومات المتصفح لعرض الإعلانات وقياسها. يمكنك متابعة القراءة دون الموافقة.',
    accept:'السماح بالإعلانات', reject:'لا أوافق', change:'تغيير تفضيل الإعلانات', privacy:'سياسة خصوصية Adsterra',
    preview:'معاينة موضع الإعلان — الإعلانات الفعلية معطلة في نطاقات المعاينة.'
  };
  const hosts = ["tawazon-health.vercel.app"];
  const key = '8bac910479557fed67a35fa63647dac4';
  const preferenceKey = 'adsterra-display-consent-v1';
  slot.style.cssText='margin:32px auto;padding:16px 0;border-block:1px solid #94a3b844;text-align:center;max-width:100%;clear:both';
  const label = document.createElement('small');
  label.textContent=text.label;
  label.style.cssText='display:block;margin-bottom:12px;opacity:.7';
  const body=document.createElement('div');
  const controls=document.createElement('div');
  controls.style.cssText='margin-top:12px;font:inherit;font-size:13px';
  slot.append(label,body,controls);
  function button(label,handler) {
    const b=document.createElement('button'); b.type='button'; b.textContent=label;
    b.style.cssText='font:inherit;padding:9px 14px;margin:5px;border:1px solid #94a3b8;border-radius:8px;background:transparent;color:inherit;cursor:pointer';
    b.addEventListener('click',handler); return b;
  }
  function save(value) {
    try { localStorage.setItem(preferenceKey,JSON.stringify({value,at:Date.now()})); } catch {}
  }
  function read() {
    try { const p=JSON.parse(localStorage.getItem(preferenceKey)); return p&&Date.now()-p.at<30*86400000?p.value:null; } catch { return null; }
  }
  function chooser() {
    body.replaceChildren(); controls.replaceChildren();
    const title=document.createElement('strong'); title.textContent=text.title;
    const p=document.createElement('p'); p.textContent=text.detail;
    p.style.cssText='max-width:520px;margin:12px auto;font-size:14px;line-height:1.7';
    const policy=document.createElement('a');policy.href='https://adsterra.com/privacy-policy-managed/';
    policy.target='_blank';policy.rel='noopener noreferrer';policy.textContent=text.privacy;
    body.append(title,p,button(text.accept,()=>{save('allow');render('allow');}),button(text.reject,()=>{save('deny');render('deny');}));
    controls.append(policy);
  }
  function render(choice) {
    if (!choice) {chooser();return;}
    body.replaceChildren();controls.replaceChildren();
    if (choice==='allow') {
      if(hosts.includes(location.hostname)) {
        const frame=document.createElement('iframe');
        frame.title=text.label;frame.width='300';frame.height='250';
        frame.style.cssText='border:0;display:block;margin:auto;max-width:100%';
        frame.referrerPolicy='no-referrer';
        frame.setAttribute('sandbox','allow-scripts allow-popups allow-popups-to-escape-sandbox');
        frame.srcdoc='<!doctype html><html><head><meta name="referrer" content="no-referrer"></head><body style="margin:0"><script>var atOptions={key:'+JSON.stringify(key)+',format:"iframe",height:250,width:300,params:{}};<\/script><script src="https://bauval.org/22/'+key+'"><\/script></body></html>';
        body.append(frame);
      } else {body.textContent=text.preview;}
    }
    controls.append(button(text.change,()=>{save(null);chooser();}));
  }
  render(read());
})();
