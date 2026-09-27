import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.dirname(here),source=path.join(repo,'docs/car-data-preview');
const output=path.join(repo,'build/peekmycar-community-review');
const bundle=path.join(output,'.vercel/output'),dest=path.join(bundle,'static');
const review=JSON.parse(fs.readFileSync(path.join(here,'review-config.json'),'utf8'));
if(!review.key.startsWith('sb_publishable_'))throw Error('Preview must use a publishable key');
execFileSync(process.execPath,[path.join(here,'build.mjs')],{stdio:'inherit',env:{...process.env,COMMUNITY_SUPABASE_URL:review.url,COMMUNITY_SUPABASE_PUBLISHABLE_KEY:review.key}});
if(!output.startsWith(path.join(repo,'build')+path.sep))throw Error('Invalid output');
fs.rmSync(output,{recursive:true,force:true});fs.mkdirSync(dest,{recursive:true});
function copy(from,to){fs.mkdirSync(to,{recursive:true});for(const e of fs.readdirSync(from,{withFileTypes:true})){if(e.name.startsWith('.')||['scripts','raw','staging'].includes(e.name))continue;const a=path.join(from,e.name),b=path.join(to,e.name);if(e.isDirectory())copy(a,b);else if(/\.(html|css|js|json|png|jpg|jpeg|webp|svg|ico|woff2?|mp4|webm|txt)$/i.test(e.name))fs.copyFileSync(a,b);}}
copy(source,dest);copy(path.join(repo,'output/community-preview/community'),path.join(dest,'community'));
let htmlCount=0;
function patch(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,e.name);if(e.isDirectory()){patch(file);continue;}if(!e.name.endsWith('.html'))continue;const route=path.relative(dest,file).replaceAll('\\','/');const prefix='../'.repeat(route.split('/').length-1)||'./';let html=fs.readFileSync(file,'utf8').replace(/<meta\b[^>]*name="robots"[^>]*>/gi,'<meta name="robots" content="noindex,nofollow,noarchive">');if(!html.includes('name="robots"'))html=html.replace('</head>','<meta name="robots" content="noindex,nofollow,noarchive"></head>');if(route.startsWith('community/'))html=html.replaceAll('https://peekmycar.com/',prefix);else html=html.replace(/(<nav\b[^>]*class="db-nav"[^>]*>)([\s\S]*?)(<\/nav>)/,(_,a,b,c)=>a+b+`<a href="${prefix}community/">커뮤니티</a>`+c);fs.writeFileSync(file,html);htmlCount++;}}
patch(dest);
// Crawling is allowed so crawlers can see noindex. This is not access control.
fs.writeFileSync(path.join(dest,'robots.txt'),'User-agent: *\nAllow: /\n');
const manifest={mode:'community-review',indexing:false,builtAt:new Date().toISOString(),sourceSha:execFileSync('git',['-c',`safe.directory=${repo.replaceAll('\\','/')}`,'rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),communitySourceSha256:createHash('sha256').update(fs.readFileSync(path.join(here,'client.js'))).digest('hex'),htmlCount};
fs.writeFileSync(path.join(dest,'review-build.json'),JSON.stringify(manifest,null,2));
fs.writeFileSync(path.join(bundle,'config.json'),JSON.stringify({version:3,routes:[
 {src:'/(.*)',headers:{'X-Robots-Tag':'noindex, nofollow, noarchive','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'},continue:true},
 {src:'^/(?:docs/)?car-data-preview(?:/(.*))?$',headers:{Location:'/$1'},status:307},
 {src:'^/((?:[^/.]+/)*[^/.]+)$',headers:{Location:'/$1/'},status:307},
 {src:'^/$',dest:'/index.html'},{src:'^/(.*)/$',dest:'/$1/index.html'},
 {handle:'filesystem'},{src:'/.*',dest:'/404.html',status:404}
]},null,2));
fs.writeFileSync(path.join(output,'.vercel/project.json'),JSON.stringify({projectId:'prj_e44w0WDgjv5hBZdyaKqxacZO0h8l',orgId:'team_BQKteJdCX91oEdvszpFI7kQy'}));
console.log(JSON.stringify({output,...manifest}));
