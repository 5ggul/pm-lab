import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const here=path.dirname(fileURLToPath(import.meta.url));
// The approved community database is isolated by pmc_* tables and its private bucket.
export function addCommunityToProduction(output){
 const config=JSON.parse(fs.readFileSync(path.join(here,'review-config.json'),'utf8'));
 if(!config.key.startsWith('sb_publishable_'))throw Error('Community requires a public client key');
 execFileSync(process.execPath,[path.join(here,'build.mjs')],{stdio:'inherit',env:{...process.env,COMMUNITY_SUPABASE_URL:config.url,COMMUNITY_SUPABASE_PUBLISHABLE_KEY:config.key}});
 const built=path.join(here,'../output/community-preview/community'),target=path.join(output,'community');
 fs.mkdirSync(target,{recursive:true});
 for(const entry of fs.readdirSync(built,{withFileTypes:true})){if(entry.isFile())fs.copyFileSync(path.join(built,entry.name),path.join(target,entry.name));}
 function patch(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const file=path.join(dir,entry.name);if(entry.isDirectory()){patch(file);continue;}if(!entry.name.endsWith('.html'))continue;
  const rel=path.relative(output,file).replaceAll('\\','/');const prefix='../'.repeat(rel.split('/').length-1)||'./';
  let html=fs.readFileSync(file,'utf8');
  if(rel==='community/index.html'){
   html=html.replaceAll('https://peekmycar.com/',prefix).replace('content="noindex,nofollow"','content="noindex,nofollow,noarchive"');
   html=html.replace('</head>','<link rel="canonical" href="https://peekmycar.com/community/"><link rel="icon" type="image/png" sizes="96x96" href="../assets/brand/favicon-96.png"></head>');
   html=html.replace('<a href="../contact/">문의</a>','<nav aria-label="커뮤니티 안내"><a href="../privacy/">개인정보</a> · <a href="../terms/">이용안내</a> · <a href="../contact/">문의·탈퇴 요청</a></nav>');
  }else html=html.replace(/(<nav\b[^>]*class="db-nav"[^>]*>)([\s\S]*?)(<\/nav>)/,(_,a,b,c)=>a+b+(b.includes('community/')?'':`<a href="${prefix}community/">커뮤니티</a>`)+c);
  if(rel==='privacy/index.html')html=html.replace('<h2>차량번호와 VIN</h2>',`<h2>커뮤니티 계정과 게시물</h2><p>구글 로그인으로 제공받는 계정 식별자와 이메일은 로그인·계정 관리에 사용합니다. 게시물에는 공개 닉네임만 표시하며 구글 이름과 이메일은 공개하지 않습니다. 글·댓글·사진·신고 내역과 작성 시각은 커뮤니티 제공 및 신고 처리에 사용합니다.</p><p>계정 인증과 데이터·사진 저장에는 Supabase, 사이트 제공에는 Vercel을 사용합니다. 공개 글과 첨부 사진은 다른 방문자가 볼 수 있습니다. 사진은 업로드 전에 위치 정보를 포함한 EXIF를 제거합니다. 글을 삭제하면 본문·사진 연결을 제거하며, 삭제된 글의 댓글은 공개되지 않습니다. 서비스 안정성을 위한 삭제 상태·신고·접속 기록은 별도로 남을 수 있습니다.</p><p>계정 탈퇴·개인정보 열람·삭제 요청은 <a href="../contact/">문의·오류 신고</a>에서 접수합니다. 사진에는 얼굴·번호판·연락처 등 불필요한 개인정보를 포함하지 마세요.</p><h2>차량번호와 VIN</h2>`);
  if(rel==='terms/index.html')html=html.replace('</main>',`<section class="db-section"><div class="db-shell narrow"><h2>커뮤니티 이용</h2><p>직접 경험한 내용과 작성 권한이 있는 사진을 올려주세요. 광고·도배·비방·개인정보 및 타인의 저작물을 무단으로 게시하면 글을 숨기거나 이용을 제한할 수 있습니다. 게시물의 신고 버튼으로 문제를 알릴 수 있습니다.</p><p>회원의 질문·후기는 공식 신고 사양이나 차량 안전 판정을 대신하지 않습니다. 본인 글과 댓글은 수정·삭제할 수 있고, 계정 삭제는 문의로 요청할 수 있습니다.</p></div></section></main>`);
  fs.writeFileSync(file,html);
 }}patch(output);
}
