const menu=document.querySelector('.menu'),nav=document.querySelector('nav');
menu?.addEventListener('click',()=>{const open=nav.classList.toggle('open');menu.setAttribute('aria-expanded',String(open))});
const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target)}}),{threshold:.12});
document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));
if(matchMedia('(prefers-reduced-motion: reduce)').matches)document.querySelectorAll('.reveal').forEach(el=>el.classList.add('visible'));

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
  filters.forEach(x=>x.classList.toggle('active',x===button));
  updateLibrary();
}));
search?.addEventListener('input',updateLibrary);
