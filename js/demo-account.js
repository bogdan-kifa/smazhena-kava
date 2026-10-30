/* Local demonstration only. No passwords, cookies, API requests or real orders. */
(() => {
  "use strict";
  if (!window.CoffeeSite?.demo) return;
  const S = window.CoffeeShop, key = "smazhena-kava:demo-account:v1";
  const fresh = () => ({version:1, active:false, user:null, mixes:[], orders:[]});
  const copy = (value) => JSON.parse(JSON.stringify(value));
  const fail = (message, status=422) => {const e=new Error(message);e.status=status;throw e;};
  function read() {
    try {const raw=localStorage.getItem(key);if(!raw)return fresh();const v=JSON.parse(raw);
      if(v.version!==1 || !Array.isArray(v.mixes)||!Array.isArray(v.orders))throw Error();return v;
    } catch {fail("Не вдалося прочитати демодані. Дозвольте збереження даних у браузері.",503);}
  }
  function write(state) {try{localStorage.setItem(key,JSON.stringify(state));}catch{fail("Браузер не зберіг демодані. Звільніть місце або дозвольте сховище.",503);}}
  const dto = (state) => state.active&&state.user ? {...state.user,mixCount:state.mixes.length} : null;
  const requireUser = (state) => {if(!dto(state))fail("Відкрийте демопрофіль, щоб продовжити.",401);};
  const validName = (v) => typeof v==="string"&&Array.from(v.trim()).length>=2&&Array.from(v.trim()).length<=80;
  const validEmail = (v) => typeof v==="string"&&v.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  function recipe(body) {
    if(!body?.recipe || !Array.isArray(body.recipe.beans) || body.recipe.beans.some(b=>!S.byId.has(b?.id)))fail("Перевірте склад міксу.");
    const name=typeof body.name==="string"?body.name.trim().replace(/\s+/g," "):"";
    if(!name||name.length>60)fail("Назва міксу: від 1 до 60 символів.");
    const m=S.recipe({...body.recipe,name});if(!S.validMix(m))fail("Сума часток має бути 100%.");return m;
  }
  let queue=Promise.resolve();
  async function handle(route,options={}) {
    const url=new URL(route,"https://demo.invalid/"), path=url.pathname,method=options.method||"GET",body=options.body||{};
    const state=read(),now=new Date().toISOString();let result;
    if(path==="/auth/me")return {user:dto(state)};
    if(["/auth/login","/auth/register"].includes(path)&&method==="POST") {
      if(!validName(body.name||state.user?.name||"Кавоман")||!validEmail(body.email))fail("Перевірте ім’я та email.");
      state.user={id:"demo-profile",name:(body.name||state.user?.name||"Кавоман").trim(),email:body.email.trim(),phone:state.user?.phone||"",address:state.user?.address||"",createdAt:state.user?.createdAt||now};state.active=true;result={user:dto(state)};
    } else if(path==="/auth/logout"&&method==="POST") {state.active=false;result={ok:true};}
    else if(path==="/profile"&&method==="PATCH") {
      requireUser(state);if(!validName(body.name)||!validEmail(body.email||state.user.email))fail("Перевірте ім’я та email.");
      if(body.phone&&!/^(?:\+380\d{9}|0\d{9})$/.test(body.phone.replace(/[\s()-]/g,"")))fail("Перевірте український номер телефону.");
      Object.assign(state.user,{name:body.name.trim(),email:(body.email||state.user.email).trim(),phone:body.phone||"",address:String(body.address||"").slice(0,300)});result={user:dto(state)};
    } else if(path==="/mixes"&&method==="GET") {requireUser(state);return {mixes:copy(state.mixes).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))};}
    else if(path==="/mixes"&&method==="POST") {requireUser(state);if(state.mixes.length>=100)fail("Можна зберегти до 100 міксів.");const m={...recipe(body),id:S.uid(),createdAt:now,updatedAt:now};state.mixes.push(m);result={mix:m};}
    else if(/^\/mixes\/[\w-]+$/.test(path)) {
      requireUser(state);const i=state.mixes.findIndex(m=>m.id===path.split('/')[2]);if(i<0)fail("Мікс не знайдено.",404);
      if(method==="DELETE"){state.mixes.splice(i,1);result={ok:true};}
      else if(method==="PATCH") {const old=state.mixes[i];const m=body.recipe?recipe(body):recipe({name:body.name,recipe:old});state.mixes[i]={...m,id:old.id,createdAt:old.createdAt,updatedAt:now};result={mix:state.mixes[i]};}
      else fail("Дія недоступна.");
    } else if(path==="/orders"&&method==="POST") {
      if(!Array.isArray(body.items)||!body.items.length)fail("Кошик порожній.");
      const c=body.customer;if(!c||!validName(c.name)||!validEmail(c.email)||!/^\+380\d{9}$/.test(c.phone)||String(c.address||"").trim().length<5)fail("Перевірте контакти та адресу.");
      const requestKey=options.headers?.["Idempotency-Key"];
      const previous=state.orders.find(o=>requestKey&&o.requestKey===requestKey);if(previous){if(previous.fingerprint!==JSON.stringify(body))fail("Кошик змінився. Повторіть оформлення.",409);return {order:previous};}
      const items=body.items.map(item=>{
        if(!Number.isInteger(item.qty)||item.qty<1||item.qty>99)fail("Перевірте кількість.");
        const p=item.type==="product"?S.byId.get(item.id):null;
        if(item.type==="product"&&!S.available(p))fail("Сорт недоступний.");
        if(item.type==="mix"&&(!S.validMix(item.mix)||item.mix.beans.some(b=>!S.available(S.byId.get(b.id)))))fail("Перевірте склад міксу.");
        if(!["product","mix"].includes(item.type))fail("Невідомий товар.");
        const unit=S.unit(item);return {...copy(item),name:S.name(item),weight:item.type==="mix"?item.mix.weight:item.weight,unit,total:unit*item.qty,image:p?.image||"assets/images/coffee/brazil-cerrado-packaging.webp",details:S.itemDetails(item)};
      });
      const total=items.reduce((sum,i)=>sum+i.total,0);if(total!==body.expectedTotal)fail("Ціна змінилася. Перевірте кошик.",409);
      const order={id:S.uid(),demo:true,status:"new",userId:dto(state)?.id||null,customer:copy(c),items,total,delivery:body.delivery,payment:"receipt",createdAt:now,requestKey,fingerprint:JSON.stringify(body)};
      state.orders.push(order);result={order};
    } else if(path==="/orders"&&method==="GET") {
      requireUser(state);const all=state.orders.filter(o=>o.userId===state.user.id).slice().reverse(),cursor=Number(url.searchParams.get('cursor')||0);
      if(!Number.isSafeInteger(cursor)||cursor<0)fail("Некоректна сторінка.");return {orders:all.slice(cursor,cursor+20),total:all.length,nextCursor:cursor+20<all.length?String(cursor+20):null};
    } else if(/^\/orders\/[\w-]+$/.test(path)&&method==="GET") {const o=state.orders.find(o=>o.id===path.split('/')[2]);if(!o)fail("Демозамовлення не знайдено в цьому браузері.",404);return {order:copy(o)};}
    else fail("Ця дія недоступна в деморежимі.",404);
    write(state);return copy(result);
  }
  window.CoffeeDemo=Object.freeze({request(route,options={}){const task=()=>handle(route,options);const run=queue.then(()=>navigator.locks?.request?navigator.locks.request(key,task):task());queue=run.catch(()=>{});return run;}});
  const form=document.querySelector('form[data-mo-auth]');
  if(form){
    form.prepend(S.node('p',{class:'mo-demo-note',text:'Деморежим. Форми лише демонструють інтерфейс: пароль не перевіряється й не зберігається. Не вводьте справжній пароль.'}));
    const email=document.getElementById('mo-auth-email');if(email&&!email.value)email.value='demo@coffee.example';
  }
  const main=document.querySelector('main');if(main&&!form&&['profile.html','orders.html','my-mixes.html','checkout.html','order-confirmation.html'].includes(location.pathname.split('/').pop()))main.prepend(S.node('p',{class:'mo-demo-note',text:'Деморежим · дані лише в цьому браузері. Замовлення не надсилаються й не оплачуються.'}));
})();
