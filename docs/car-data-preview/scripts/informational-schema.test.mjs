import assert from 'node:assert/strict';
import test from 'node:test';
import {informationalSchema, normalizeInformationalHtml, assertInformationalSchema} from './informational-schema.mjs';

test('vehicle facts remain descriptive and WebPage mainEntity still resolves', () => {
 const input = {'@context':'https://schema.org', '@graph':[
  {'@type':'WebPage', mainEntity:{'@id':'https://peekmycar.com/car/#vehicle'}},
  {'@type':'Vehicle','@id':'https://peekmycar.com/car/#vehicle',name:'그랜저',image:'/car.webp',brand:{'@type':'Brand',name:'현대'},vehicleConfiguration:'2.5 가솔린',additionalProperty:[{name:'복합 효율',value:'11.7',unitText:'km/L'},{name:'연간 자동차세',value:649220,unitText:'원'}]},
  {'@type':'BreadcrumbList',itemListElement:[]}
 ]};
 const result = informationalSchema(input);
 assert.equal(result['@graph'][1]['@type'],'Thing');
 assert.equal(result['@graph'][0].mainEntity['@id'],result['@graph'][1]['@id']);
 assert.equal(result['@graph'][1].description,'2.5 가솔린 · 복합 효율: 11.7 km/L · 연간 자동차세: 649220 원');
 assert.equal(result['@graph'][1].image,'/car.webp');
 assert.equal(result['@graph'][1].brand,undefined);
 assert.deepEqual(result['@graph'][2],input['@graph'][2]);
 assert.equal(input['@graph'][1]['@type'],'Vehicle');
 assert.deepEqual(informationalSchema(result),result);
 assertInformationalSchema(result);
 assert.throws(()=>assertInformationalSchema(input));
});

test('nested and qualified Product types cannot bypass release gate', () => {
 for (const type of ['Car','Product','https://schema.org/Vehicle',['Thing','Vehicle']]) {
  const input = [{item:{'@type':type,name:'차량'}}];
  assert.throws(()=>assertInformationalSchema(input));
  assertInformationalSchema(informationalSchema(input));
 }
});

test('HTML retains visible content and unrelated schemas without unsafe script text', () => {
 const html = `<h1>그랜저</h1><script type='application/ld+json'>${JSON.stringify({'@type':'Vehicle',name:'차량 < 테스트'})}</script><script type="application/ld+json">{"@type":"WebSite","name":"픽마이카"}</script>`;
 const result = normalizeInformationalHtml(html);
 assert(result.startsWith('<h1>그랜저</h1>'));
 assert(result.includes('\\u003c'));
 assert(result.includes('"@type":"WebSite"'));
 assert.equal(normalizeInformationalHtml(result),result);
 assert.throws(()=>normalizeInformationalHtml('<script type="application/ld+json">broken</script>'));
});
