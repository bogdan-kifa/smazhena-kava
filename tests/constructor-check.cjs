const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = process.argv[2] || path.resolve(__dirname,'..');
const context = vm.createContext({window:{},console});
for (const file of ['products.js','commerce-rules.js']) vm.runInContext(fs.readFileSync(path.join(root,'js',file),'utf8'),context);
const code=fs.readFileSync(path.join(root,'js/shop.js'),'utf8');
vm.runInContext(`const products=window.COFFEE_PRODUCTS; const byId=new Map(products.map(p=>[p.id,p])); const {weights,grinds,roasts,packaging}=window.CoffeeRules; const isGreen=p=>p?.category==='green';`+
 code.slice(code.indexOf('  const validMix ='),code.indexOf('  function recipe('))+
 code.slice(code.indexOf('  const mixPrice ='),code.indexOf('  const tasteDimensions'))+
 ';window.test={validMix,mixPrice};',context);
const api=context.window.test;
const good={beans:[{id:'ethiopia-guji',ratio:100}],weight:250,grind:'filter',packaging:'1'};
const modify=(patch)=>({...good,...patch});
const cases=[
 ['valid recipe',good,true],['empty',modify({beans:[]}),false],['null',null,false],
 ['missing beans',{},false],['unknown bean',modify({beans:[{id:'missing',ratio:100}]}),false],
 ['negative weight',modify({weight:-250}),false],['infinite weight',modify({weight:Infinity}),false],
 ['unsupported weight',modify({weight:999999999}),false],['invalid packaging',modify({packaging:'999'}),false],
 ['invalid grind',modify({grind:'missing'}),false],['null bean',modify({beans:[null]}),false],
 ['fractional ratio',modify({beans:[{id:'ethiopia-guji',ratio:99.5}]}),false],
 ['negative ratio',modify({beans:[{id:'ethiopia-guji',ratio:-100}]}),false],
 ['duplicate bean',modify({beans:[{id:'ethiopia-guji',ratio:50},{id:'ethiopia-guji',ratio:50}]}),false],
 ['incomplete',modify({beans:[{id:'ethiopia-guji',ratio:50}]}),false],
 ['NaN ratio',modify({beans:[{id:'ethiopia-guji',ratio:NaN}]}),false],
 ['string ratio',modify({beans:[{id:'ethiopia-guji',ratio:'100'}]}),false],
 ['five beans',modify({beans:['ethiopia-guji','colombia-huila','brazil-cerrado','kenya-nyeri','peru-cajamarca'].map(id=>({id,ratio:20}))}),false],
 ['green valid roast',modify({beans:[{id:'brazil-cerrado-green',ratio:100,roast:'dark'}]}),true],
 ['green invalid roast',modify({beans:[{id:'brazil-cerrado-green',ratio:100,roast:'raw'}]}),false],
];
const results=cases.map(([name,value,expected])=>{let actual,error;try{actual=api.validMix(value)}catch(e){error=e.message}return {name,expected,actual,error,pass:!error&&actual===expected}});
for(const [name,value,expected] of [['price250',good,36000],['price500+box',modify({weight:500,packaging:'2'}),76000],['invalidPrice',modify({weight:-250}),0],['missingPrice',modify({beans:[{id:'missing',ratio:100}]}),0]]){
 let actual,error;try{actual=api.mixPrice(value)}catch(e){error=e.message}results.push({name,expected,actual,error,pass:!error&&actual===expected});
}
function storageCase(name,options,check) {
 const store=vm.createContext({window:{},console,navigator:{locks:{request(){}}},
 localStorage:{getItem(){if(options.readBlocked)throw Error('blocked');return options.raw??null},setItem(){if(options.localBlocked)throw Error('quota')}},
 sessionStorage:{getItem(){if(options.readBlocked)throw Error('blocked');return null},setItem(){if(options.sessionBlocked)throw Error('quota')}}});
 for(const file of ['products.js','commerce-rules.js'])vm.runInContext(fs.readFileSync(path.join(root,'js',file),'utf8'),store);
 try {
 vm.runInContext(`const products=window.COFFEE_PRODUCTS; const byId=new Map(products.map(p=>[p.id,p]));const {weights,grinds,roasts,packaging}=window.CoffeeRules;const isGreen=p=>p?.category==='green';const key='test';`+
 code.slice(code.indexOf('  const emptyMix ='),code.indexOf('  const sessionKey ='))+
 code.slice(code.indexOf('  const sessionKey ='),code.indexOf('  function storageNotice('))+
 code.slice(code.indexOf('  function persist('),code.indexOf('  // Every mutation'))+
 ';window.test={mix,normalize,read,persist,mode:()=>storageMode};',store);
 const pass=Boolean(check(store.window.test));results.push({name,pass});
 }catch(e){results.push({name,pass:false,error:e.message})}
}
storageCase('corrupt JSON recovers',{raw:'{invalid'},s=>s.read().draft.beans.length===0);
storageCase('null state recovers',{raw:'null'},s=>s.read().cart.length===0);
storageCase('unknown stored bean removed',{raw:JSON.stringify({draft:{beans:[{id:'missing',ratio:100}]}})},s=>s.read().draft.beans.length===0);
storageCase('invalid stored settings recover',{},s=>{const m=s.mix({beans:[],weight:Infinity,grind:'bad',packaging:'99'});return m.weight===200&&m.grind==='filter'&&m.packaging==='1'});
storageCase('negative stored ratio reset',{},s=>s.mix({beans:[{id:'ethiopia-guji',ratio:-1}]}).beans[0].ratio===0);
storageCase('duplicate stored beans removed',{},s=>s.mix({beans:[{id:'ethiopia-guji',ratio:50},{id:'ethiopia-guji',ratio:50}]}).beans.length===1);
storageCase('local quota uses session',{localBlocked:true},s=>s.persist(s.read())===true&&s.mode()==='session');
storageCase('both stores blocked fails safely',{localBlocked:true,sessionBlocked:true},s=>s.persist(s.read())===false&&s.mode()==='memory');
storageCase('blocked reads recover',{readBlocked:true},s=>s.read().draft.beans.length===0);
console.log(JSON.stringify({passed:results.filter(r=>r.pass).length,total:results.length,results},null,2));
process.exitCode=results.every(r=>r.pass)?0:1;
