// Script-tag loader (PRD 5.1): turns each .business-finder div into the same iframe.
const js = (origin: string) => `(function(){
var O=${JSON.stringify(origin)};
function mount(el){ if(el.dataset.bfMounted) return; el.dataset.bfMounted="1";
 var q=new URLSearchParams(); if(el.dataset.id&&/^bf_[A-Za-z0-9]{8,10}$/.test(el.dataset.id)){ var src=O+"/e/"+el.dataset.id+(el.dataset.theme?"?theme="+encodeURIComponent(el.dataset.theme):""); } ["lat","lng","name","street","lgu","autoplay","landmarks"].forEach(function(k){ if(el.dataset[k]!=null) q.set(k, el.dataset[k]); });
 var f=document.createElement("iframe"); f.src=src||(O+"/embed?"+q.toString()); f.width="100%";
 f.height=String(parseInt(el.dataset.height||"400",10)||400); f.style.border="0"; f.loading="lazy";
 f.title="Business location map"; f.allowFullscreen=true; el.appendChild(f); }
function run(){ document.querySelectorAll(".business-finder").forEach(mount); }
document.readyState==="loading"?document.addEventListener("DOMContentLoaded",run):run();
})();`;
export const onRequestGet: PagesFunction = ({ request }) =>
  new Response(js(new URL(request.url).origin), { headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "public, max-age=300" } });
