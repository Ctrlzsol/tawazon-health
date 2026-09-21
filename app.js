const menu=document.querySelector('.menu'),nav=document.querySelector('nav');
menu?.addEventListener('click',()=>{const open=nav.classList.toggle('open');menu.setAttribute('aria-expanded',String(open))});
const search=document.querySelector('#article-search');
const filters=[...document.querySelectorAll('.filter')];
const libraryCards=[...document.querySelectorAll('#library-grid .article-card')];
const count=document.querySelector('#results-count');
const empty=document.querySelector('#empty-state');
let activeFilter='all';
function updateLibrary(){
  if(!libraryCards.length)return;
  const query=(search?.value||'').trim().toLocaleLowerCase('ar');
  let visible=0;
  for(const item of libraryCards){
    const show=(activeFilter==='all'||item.dataset.category===activeFilter)&&(!query||(item.dataset.search||'').toLocaleLowerCase('ar').includes(query));
    item.hidden=!show;if(show)visible++;
  }
  if(count)count.textContent=`عرض ${visible} من ${libraryCards.length} مقالاً`;
  if(empty)empty.hidden=visible!==0;
}
filters.forEach(button=>button.addEventListener('click',()=>{
  activeFilter=button.dataset.filter;
  filters.forEach(x=>{x.classList.toggle('active',x===button);x.setAttribute('aria-pressed',String(x===button))});
  updateLibrary();
}));
search?.addEventListener('input',updateLibrary);

nav?.addEventListener('click',e=>{if(e.target.closest('a')){nav.classList.remove('open');menu?.setAttribute('aria-expanded','false')}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&nav?.classList.contains('open')){nav.classList.remove('open');menu?.setAttribute('aria-expanded','false');menu?.focus()}});
filters.forEach(x=>x.setAttribute('aria-pressed',String(x.classList.contains('active'))));
