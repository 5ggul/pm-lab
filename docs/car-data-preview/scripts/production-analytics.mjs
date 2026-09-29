import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

export const measurementId = 'G-9LMZK1MJ41';
export const analyticsCode = `(function () {
  if (!['peekmycar.com', 'www.peekmycar.com'].includes(location.hostname) || window.__peekmycarAnalytics) return;
  window.__peekmycarAnalytics = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  var referrer = '';
  try { var ref = new URL(document.referrer); referrer = ref.origin + ref.pathname; } catch (_) {}
  window.gtag('js', new Date());
  window.gtag('config', '${measurementId}', {
    page_location: location.origin + location.pathname,
    page_referrer: referrer,
    allow_google_signals: false,
    allow_ad_personalization_signals: false
  });
  var script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=${measurementId}';
  document.head.appendChild(script);
})();`;

export function addAnalytics(html) {
 if (html.includes('id="peekmycar-analytics"')) return html;
 assert(html.includes('</head>'), 'Analytics requires an HTML head');
 return html.replace('</head>', `<script id="peekmycar-analytics">${analyticsCode}</script>\n</head>`);
}

export function addProductionAnalytics(output) {
 function walk(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
   const file = path.join(dir, entry.name);
   if (entry.isDirectory()) walk(file);
   else if (entry.name.endsWith('.html')) fs.writeFileSync(file, addAnalytics(fs.readFileSync(file, 'utf8')));
  }
 }
 walk(output);
 const privacy = path.join(output, 'privacy/index.html');
 let html = fs.readFileSync(privacy, 'utf8');
 const section = /<h2>로그·분석·광고<\/h2><p>[\s\S]*?<\/p>/;
 assert(section.test(html), 'Privacy analytics disclosure section missing');
 html = html.replace(section, '<h2>로그·방문 분석</h2><p>픽마이카는 서비스 이용 현황과 개선점을 파악하기 위해 Google Analytics 4를 사용합니다. 방문 페이지, 접속 시각, 브라우저·기기 정보와 쿠키 기반 식별자 등이 Google로 전송될 수 있습니다. 페이지 주소와 유입 주소에서는 검색·계산 조건 및 로그인 정보가 포함될 수 있는 쿼리와 해시를 제외합니다. 구글 신호 데이터와 광고 개인 최적화는 사용하지 않습니다.</p><p>브라우저 설정에서 쿠키를 차단하거나 <a href="https://tools.google.com/dlpage/gaoptout" rel="noopener noreferrer">Google Analytics 차단 도구</a>를 이용할 수 있습니다. 자세한 내용은 <a href="https://policies.google.com/privacy" rel="noopener noreferrer">Google 개인정보처리방침</a>을 확인하세요.</p>');
 fs.writeFileSync(privacy, html);
}
