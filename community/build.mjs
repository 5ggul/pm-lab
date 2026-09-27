import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
const here=path.dirname(fileURLToPath(import.meta.url));
const site=path.resolve(here,'../docs/car-data-preview');
const out=path.resolve(here,'../output/community-preview');
fs.mkdirSync(path.join(out,'community'),{recursive:true});
fs.mkdirSync(path.join(out,'assets/brand'),{recursive:true});
for(const name of ['tokens.css','base.css','header-nav.js','pretendard-variable.woff2'])fs.copyFileSync(path.join(site,'assets',name),path.join(out,'assets',name));
fs.copyFileSync(path.join(site,'assets/brand/peekmycar-logo.png'),path.join(out,'assets/brand/peekmycar-logo.png'));
fs.copyFileSync(path.join(here,'index.html'),path.join(out,'community/index.html'));
fs.copyFileSync(path.join(here,'community.css'),path.join(out,'community/community.css'));
const families=JSON.parse(fs.readFileSync(path.join(site,'data/generated/catalog-list-index.json'),'utf8')).families.map(({family_id,family_name,maker,path:detail})=>({id:family_id,name:family_name,maker,detail}));
fs.writeFileSync(path.join(out,'community/vehicles.json'),JSON.stringify(families));
// This preview does not alter the production build or disclose server credentials.
fs.writeFileSync(path.join(out,'community/config.json'),JSON.stringify({url:process.env.COMMUNITY_SUPABASE_URL||'',key:process.env.COMMUNITY_SUPABASE_PUBLISHABLE_KEY||''}));
await build({entryPoints:[path.join(here,'client.js')],outfile:path.join(out,'community/app.js'),bundle:true,format:'esm',target:['es2022'],minify:true,legalComments:'eof'});
console.log(`Community preview: ${out}; ${families.length} vehicle boards`);
