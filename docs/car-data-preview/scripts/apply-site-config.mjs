import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {siteConfig,pageUrl} from './site-config.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
if(siteConfig.indexingEnabled)throw Error('Public indexing requires the separate final-domain release review.');
function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){
 if(['assets','data','scripts'].includes(item.name))continue;
 const file=path.join(dir,item.name);if(item.isDirectory()){walk(file);continue;}if(!file.endsWith('.html'))continue;
 const relative=path.relative(root,file).replaceAll('\\','/');
 let html=fs.readFileSync(file,'utf8').replace(/<meta\b[^>]*name="robots"[^>]*>/gi,'').replace(/<link\b[^>]*rel="canonical"[^>]*>/gi,'');
 html=html.replace('</head>',`<meta name="robots" content="${siteConfig.robots}"><link rel="canonical" href="${pageUrl(relative)}"></head>`);
 fs.writeFileSync(file,html);
}}
walk(root);
console.log('Site configuration: canonical URLs aligned; indexing remains disabled.');
