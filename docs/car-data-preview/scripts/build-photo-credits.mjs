import fs from 'node:fs';
const root=new URL('../',import.meta.url);
const records=JSON.parse(fs.readFileSync(new URL('data/vehicle-image-sources.json',root))).records;
const hero=JSON.parse(fs.readFileSync(new URL('data/hero-image.json',root)));
// Browsers need display fields only; source evidence stays in the full manifest.
const display=records.map(r=>Object.fromEntries(['family_id','generation','display_note','author','license','license_url','source_page','image_url','width','height','optimized'].map(k=>[k,r[k]])));
fs.writeFileSync(new URL('data/vehicle-photo-index.json',root),JSON.stringify({schema_version:1,records:display})+'\n');
const file=new URL('media-policy/index.html',root);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const photos=[...new Map(records.map(r=>[r.source_page,r])).values()];
const section=`<!-- photo-credits:start --><section class="db-section"><div class="db-shell narrow"><h2 id="home-hero-photo">메인 사진</h2><p>아이오닉 6 스튜디오 사진 · <a href="${esc(hero.source_page)}" target="_blank" rel="noopener">${esc(hero.author)}</a> · <a href="${esc(hero.license_url)}" target="_blank" rel="noopener">${esc(hero.license)}</a>. 크기 조정과 WebP 변환만 적용했습니다.</p><h2>사진별 출처와 이용 조건</h2><p>각 사진의 제목·저작자·원문·라이선스입니다. 화면용 사본은 방향·크기·파일 형식을 조정했으며 원본과 같은 라이선스를 따릅니다. 원본에 이미 적용된 편집은 원문 파일 설명에서 확인할 수 있습니다.</p><details class="photo-license-directory"><summary>차량 사진 ${photos.length}종 출처 보기</summary><ol>${photos.map(r=>`<li style="margin-block:16px;overflow-wrap:anywhere"><a href="${esc(r.source_page)}" target="_blank" rel="noopener">${esc(r.file)}</a><br>저작자: ${esc(r.author)} · <a href="${esc(r.license_url)}" target="_blank" rel="noopener">${esc(r.license)}</a>${r.attribution_notice?'<br>'+esc(r.attribution_notice):''}<br>${esc(r.changes)}</li>`).join('')}</ol></details></div></section><!-- photo-credits:end -->`;
let html=fs.readFileSync(file,'utf8').replace(/<!-- photo-credits:start -->[\s\S]*?<!-- photo-credits:end -->/,'');
html=html.replace('저작자·출처·라이선스 조건을 이미지 가까이에 표시합니다.','저작자·출처·라이선스 조건을 이 페이지에 모아 공개합니다.');
html=html.replace('</main>',section+'</main>');
fs.writeFileSync(file,html);
console.log(`Photo credits: ${photos.length} unique source files, ${records.length} catalogue mappings`);
