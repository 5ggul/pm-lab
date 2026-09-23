import fs from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {siteConfig} from './site-config.mjs';

// Error documents are served at the missing URL, so links cannot be relative
// to that URL. Derive the mount path from the same setting as canonical URLs.
export function host404(baseUrl) {
  const mount=new URL(baseUrl).pathname.replace(/\/?$/,'/');
  if (!/^\/[\w/.-]*$/.test(mount)) throw new Error('Unsupported site mount path');
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>페이지를 찾을 수 없습니다 | 내차데이터</title><meta name="robots" content="noindex,nofollow,noarchive"><link rel="stylesheet" href="${mount}assets/tokens.css"><link rel="stylesheet" href="${mount}assets/base.css"></head><body data-reference-page="information"><header class="db-header"><div class="db-shell"><a class="db-logo" href="${mount}">내차데이터</a><nav class="db-nav" aria-label="주 메뉴"><a href="${mount}cars/">찾기</a><a href="${mount}compare/">비교</a><a href="${mount}rankings/">순위</a><a href="${mount}recalls/">리콜</a></nav></div></header><main class="content-page"><div class="shell narrow"><h1>페이지를 찾을 수 없습니다.</h1><p>주소가 바뀌었거나 현재 제공하지 않는 페이지입니다.</p><p><a class="button" href="${mount}">홈으로</a> <a class="button" href="${mount}cars/">차량 찾기</a></p></div></main></body></html>\n`;
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  fs.writeFileSync(fileURLToPath(new URL('../../404.html',import.meta.url)),host404(siteConfig.baseUrl));
}
