import { readFileSync } from 'node:fs';
import { OFFLINE_DEMO_PASSWORD } from '../tools/offline-seed.mjs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
const noop=()=>{};class FakeEl{constructor(t='div'){this.tagName=String(t).toUpperCase();this.children=[];this.dataset={};this.attributes={};this.value='';this.checked=false;this.hidden=false;this.disabled=false;this.style={setProperty:noop,width:''};this.classList={add:noop,remove:noop,contains:()=>false,toggle:noop};this.scrollTop=0;this.scrollHeight=0;this.textContent='';}appendChild(c){this.children.push(c);return c;}insertBefore(n){return n;}addEventListener(){}removeEventListener(){}setAttribute(k,v){this.attributes[k]=v;}getAttribute(k){return this.attributes[k]??null;}removeAttribute(){}remove(){}focus(){}scrollIntoView(){}reset(){}click(){}querySelector(){return new FakeEl('div');}querySelectorAll(){return[];}closest(){return this;}get firstElementChild(){return null;}get parentNode(){return null;}get innerHTML(){return this._html||'';}set innerHTML(v){this._html=v;}getContext(){return{drawImage:noop,getImageData:()=>({data:new Uint8ClampedArray(4096)}),fillRect:noop,save:noop,restore:noop,translate:noop,clearRect:noop};}getBoundingClientRect(){return{top:0,left:0,width:100,height:40,right:100,bottom:40};}}
const docEl=new FakeEl('html');const LS=new Map();
globalThis.window=globalThis;
globalThis.document={createElement:(t)=>new FakeEl(t),createElementNS:(ns,t)=>new FakeEl(t),createTextNode:(t)=>({text:t}),getElementById:()=>new FakeEl('div'),querySelector:()=>new FakeEl('div'),querySelectorAll:()=>[],documentElement:docEl,body:new FakeEl('body'),head:new FakeEl('head'),cookie:'',addEventListener:noop,removeEventListener:noop,dispatchEvent:noop,title:'',hidden:false,readyState:'complete'};
globalThis.location={hash:'#/',href:'file:///x/index.html',origin:'null',pathname:'/',search:'',host:'',replace(){},assign(){}};
globalThis.history={pushState:noop,replaceState:noop,back:noop};
Object.defineProperty(globalThis,'navigator',{value:{userAgent:'node',language:'fa-IR',clipboard:{writeText:async()=>{}},serviceWorker:null,onLine:true,geolocation:{getCurrentPosition:noop}},configurable:true});
globalThis.localStorage={getItem:(k)=>LS.has(k)?LS.get(k):null,setItem:(k,v)=>LS.set(k,String(v)),removeItem:(k)=>LS.delete(k),key:()=>null,length:0};
globalThis.sessionStorage={getItem:()=>null,setItem:noop,removeItem:noop};
globalThis.matchMedia=()=>({matches:false,media:'',addEventListener:noop,removeEventListener:noop,addListener:noop});
globalThis.requestAnimationFrame=(fn)=>setTimeout(()=>fn(Date.now()),0);globalThis.cancelAnimationFrame=noop;
globalThis.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};globalThis.MutationObserver=class{observe(){}disconnect(){}};globalThis.ResizeObserver=class{observe(){}disconnect(){}};
globalThis.Image=class{set src(v){setTimeout(()=>this.onerror?.(),0);}};
globalThis.addEventListener=noop;globalThis.removeEventListener=noop;globalThis.dispatchEvent=noop;
globalThis.scrollTo=noop;globalThis.scrollBy=noop;globalThis.scroll=noop;globalThis.print=noop;globalThis.open=noop;globalThis.close=noop;globalThis.alert=noop;globalThis.confirm=()=>true;globalThis.prompt=()=>'';globalThis.focus=noop;
globalThis.getComputedStyle=()=>({getPropertyValue:()=>''});
globalThis.CustomEvent=class{constructor(t,o){this.type=t;Object.assign(this,o);}};
globalThis.innerWidth=1360;globalThis.innerHeight=900;globalThis.devicePixelRatio=1;
const html=readFileSync(fileURLToPath(new URL('../yassaei-offline.html', import.meta.url)),'utf-8');
for (const key of ['__SEED','__ASSETS']) { const mm=html.match(new RegExp(`<script>window\\.${key} = (\\{[\\s\\S]*?\\});</script>`)); if (mm) globalThis[key]=JSON.parse(mm[1]); }
const m=html.match(/<script>\n\(function\(\)\{\n'use strict';\nconst __REG[\s\S]*?<\/script>/);
vm.runInThisContext(m[0].replace(/^<script>\n/,'').replace(/\n<\/script>$/,''),{filename:'bundle.js'});
await new Promise(r=>setTimeout(r,250));
const REQ=globalThis.__REQ, A=globalThis.__STANDALONE_API;
await A.api.post('/api/auth/login',{identifier:'admin',password:OFFLINE_DEMO_PASSWORD});
const store=REQ('views/home.mjs')?null:null;
const list=[['views/home.mjs',{}],['views/catalog.mjs',{}],['views/product.mjs',{id:'p001'}],['views/cart.mjs',{}],['views/checkout.mjs',{}],['views/compare.mjs',{}],['views/price-check.mjs',{}],['views/search-image.mjs',{}],['views/auth.mjs',{}],['views/account.mjs',{}],['views/order-detail.mjs',{id:'x'}],['views/ticket-detail.mjs',{id:'x'}],['views/page.mjs',{key:'about'}],['views/page.mjs',{key:'contact'}],['views/stats.mjs',{}],['views/admin/settings.mjs',{section:'settings',id:'partners'}],['views/not-found.mjs',{}]];
let fail=0;
for (const [id,params] of list) {
  try { const mod=REQ(id); const out=String(await mod.render({params,query:new URLSearchParams()})); console.log('✔',id,`(${out.length})`); }
  catch(e){ console.log('✘',id,'→',e.message); fail++; }
}
for (const id of ['dashboard','products','orders','reviews','tickets','feedback','users','marketing','settings','pages','devices','insights','index','catalog']) {
  const path=`views/admin/${id}.mjs`;
  try { const mod=REQ(path); const out=String(await mod.render({params:{},query:new URLSearchParams()})); console.log('✔ admin/'+id,`(${out.length})`); }
  catch(e){ console.log('✘ admin/'+id,'→',e.message); fail++; }
}
console.log(fail?`\n✘ ${fail} crash`:'\n✔ همه نماها با دادهٔ محلی رندر شدند');
process.exit(fail?1:0); // تایمرهای قلب‌ضرب نباید خروج هارنس را نگه دارند
