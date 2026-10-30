/* Generate shared page chrome while keeping the site usable without JavaScript. */
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
function synchronize(){
 const parts=Object.fromEntries(["header","footer"].map(tag=>[tag,fs.readFileSync(path.join(__dirname,"layouts",tag+".html"),"utf8")]));
 const pages=[...fs.readdirSync(root).filter(f=>f.endsWith(".html")),...fs.readdirSync(path.join(root,"products")).filter(f=>f.endsWith(".html")).map(f=>"products/"+f)];
 for(const page of pages){
  const filename=path.join(root,page),prefix=page.startsWith("products/")?"../":"";
  let html=fs.readFileSync(filename,"utf8");
  for(const tag of ["header","footer"]){
   if(!new RegExp("<"+tag+"\\b").test(html))continue;
   let part=parts[tag].replace(/\saria-current="[^"]*"/g,"");
   part=part.replace(/(href|src)="([^"#:]+)"/g,(all,attribute,url)=>{
    if(/^(?:https?:|mailto:|tel:|viber:|\/)/.test(url))return all;
    const active=tag==="header"&&url===page?' aria-current="page"':"";
    return attribute+'="'+prefix+url+'"'+active;
   });
   html=html.replace(new RegExp("<"+tag+"\\b[^>]*>[\\s\\S]*?</"+tag+"\\s*>"),()=>part);
  }
  fs.writeFileSync(filename,html);
 }
}
module.exports={synchronize};
if(require.main===module)synchronize();
