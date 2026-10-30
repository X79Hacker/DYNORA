// Keep the camera and every navigation label outside the scrolling pane.
export function initStudioLayout(){
 const side=document.getElementById('side'),tabs=side?.querySelector('.tabs');if(!side||!tabs)return;
 const scroll=document.createElement('div');scroll.id='panelScroll';scroll.tabIndex=0;scroll.setAttribute('aria-label','Selected control panel');
 for(const pane of [...side.querySelectorAll(':scope > .pane')])scroll.append(pane);side.append(scroll);
 tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Studio panels');
 function sync(){for(const b of tabs.querySelectorAll('button')){b.setAttribute('role','tab');b.id='tab-'+b.dataset.t;b.setAttribute('aria-controls','t-'+b.dataset.t);b.setAttribute('aria-selected',String(b.classList.contains('on')));b.tabIndex=b.classList.contains('on')?0:-1;const pane=document.getElementById('t-'+b.dataset.t);if(pane){pane.setAttribute('role','tabpanel');pane.setAttribute('aria-labelledby',b.id)}}}
 tabs.addEventListener('click',e=>{if(e.target.closest('button')){queueMicrotask(sync);scroll.scrollTop=0}});
 tabs.addEventListener('keydown',e=>{const a=[...tabs.querySelectorAll('button')].filter(b=>!b.hidden),i=a.indexOf(document.activeElement);let n=i;if(e.key==='ArrowRight')n=(i+1)%a.length;else if(e.key==='ArrowLeft')n=(i+a.length-1)%a.length;else if(e.key==='Home')n=0;else if(e.key==='End')n=a.length-1;else return;e.preventDefault();a[n].click();a[n].focus()});
 const toggle=document.createElement('button');toggle.id='cameraCollapse';toggle.type='button';toggle.textContent='Hide feed';toggle.setAttribute('aria-expanded','true');toggle.setAttribute('aria-controls','camf');side.querySelector('.cam h3')?.append(toggle);toggle.onclick=()=>{const hidden=side.classList.toggle('camera-collapsed');toggle.textContent=hidden?'Show feed':'Hide feed';toggle.setAttribute('aria-expanded',String(!hidden));window.dispatchEvent(new Event('resize'))};sync();
}
