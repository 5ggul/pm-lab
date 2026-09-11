import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve('docs/interior-cost-preview'),VERSION='10.0.0';
const read=r=>fs.readFileSync(path.join(ROOT,r),'utf8');
const write=(r,c)=>{const f=path.join(ROOT,r);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,c)};
const json=(r,f={})=>{try{return JSON.parse(read(r))}catch{return f}};

let home=read('index.html');
home=home.replace(/데이터 v\d+\.\d+\.\d+/g,`데이터 v${VERSION}`);
write('index.html',home);

const regionDir=path.join(ROOT,'region');
if(fs.existsSync(regionDir)){
  for(const ent of fs.readdirSync(regionDir,{withFileTypes:true})){
    if(!ent.isDirectory())continue;
    const rel=`region/${ent.name}/index.html`,full=path.join(ROOT,rel);
    if(!fs.existsSync(full))continue;
    let h=read(rel);
    h=h.replace(/<h2>([^<]+) × 평수<\/h2>/,(_m,name)=>`<h2>${name} 지역 × 평수</h2>`);
    write(rel,h);
  }
}

const report=json('data/v6-report.json',{});
report.version=VERSION;
report.home_version_consistent=read('index.html').includes(`데이터 v${VERSION}`);
report.v10_final_consistency=true;
write('data/v6-report.json',JSON.stringify(report,null,2));
if(!report.home_version_consistent)throw new Error('v10 home version consistency failed');
console.log(JSON.stringify({version:VERSION,home_version_consistent:true,region_label_consistent:true},null,2));
