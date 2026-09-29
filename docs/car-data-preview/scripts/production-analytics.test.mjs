import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {analyticsCode, addAnalytics, measurementId} from './production-analytics.mjs';

function browser(url) {
 const scripts = [];
 const context = vm.createContext({window: {}, location: new URL(url), URL, document: {
  referrer: 'https://peekmycar.com/community/?code=private#access_token=private',
  createElement: () => ({}), head: {appendChild: script => scripts.push(script)}
 }});
 return {context, scripts, run: () => vm.runInContext(analyticsCode, context)};
}
test('production initializes once and excludes query/hash from analytics locations', () => {
 const b = browser('https://peekmycar.com/community/?code=private#access_token=private');
 b.run(); b.run();
 assert.equal(b.scripts.length, 1);
 assert.equal(b.scripts[0].src, 'https://www.googletagmanager.com/gtag/js?id=' + measurementId);
 assert.equal(b.scripts[0].async, true);
 assert.equal(b.context.window.dataLayer.length, 2);
 const config = b.context.window.dataLayer[1];
 assert.equal(config[0], 'config'); assert.equal(config[1], measurementId);
 assert.equal(config[2].page_location, 'https://peekmycar.com/community/');
 assert.equal(config[2].page_referrer, 'https://peekmycar.com/community/');
 assert.equal(config[2].allow_google_signals, false);
});
test('local and preview hosts never load Google Analytics', () => {
 for (const url of ['http://127.0.0.1:4173/', 'http://localhost:4190/', 'https://peekmycar.pages.dev/', 'https://test.peekmycar.pages.dev/', 'https://peekmycar.com.example.com/']) {
  const b = browser(url); b.run(); assert.equal(b.scripts.length, 0); assert.equal(b.context.window.dataLayer, undefined);
 }
});
test('all-page head insertion is idempotent', () => {
 const html = '<html><head><title>픽마이카</title></head><body>차량 정보</body></html>';
 const tagged = addAnalytics(html);
 assert.equal(addAnalytics(tagged), tagged);
 assert.equal((tagged.match(/id="peekmycar-analytics"/g) || []).length, 1);
 assert(tagged.indexOf('peekmycar-analytics') < tagged.indexOf('</head>'));
 assert(tagged.includes('<body>차량 정보</body>'));
});
