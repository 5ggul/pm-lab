import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

// Read only the isolated release. Never rebuild pages, fetch a remote URL, or
// supply another fuel price: the bundle must already contain one coherent basis.
const root=path.resolve(process.argv[2]||fileURLToPath(new URL('../../../build/peekmycar-production/',import.meta.url)));
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const catalog=JSON.parse(read('data/generated/catalog.json'));
const fuel=JSON.parse(read('data/fuel-price.json'));
const manifest=JSON.parse(read('review-build.json'));
const origin=new URL(manifest.origin);
const context=vm.createContext({});
for(const file of ['cost-math.js','decision-math.js'])vm.runInContext(read('assets/'+file),context,{filename:file});
const math=context.CAR_COST_MATH,decision=context.CAR_DECISION_MATH;
const gasoline=['grandeur-vs-k8','sorento-vs-santafe','grandeur-gasoline-vs-hybrid','sorento-gasoline-vs-hybrid'];
const electric=['ioniq5-vs-ev6','ev3-vs-ev6'];
const failures=[],results=[];
let checks=0;
function equal(actual,expected,label){checks++;assert.equal(actual,expected,label);}
function valid(condition,label){checks++;assert(condition,label);}
function text(value){return String(value??'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim();}
function attributes(tag){return Object.fromEntries([...tag.slice(0,tag.indexOf('>')+1).matchAll(/\s+([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)].map(match=>[match[1].toLowerCase(),text(match[2]??match[3]??match[4])]));}
function tags(html,name){return [...html.matchAll(new RegExp('<'+name+'\\b[^>]*>','gi'))].map(match=>attributes(match[0]));}
function one(values,label){equal(values.length,1,label+' appears once');return values[0];}
function meta(html,key){return one(tags(html,'meta').filter(tag=>tag.name===key||tag.property===key),key+' metadata').content;}
function innerById(html,tag,id){return one([...html.matchAll(new RegExp('<'+tag+'\\b[^>]*\\bid=["\']'+id+'["\'][^>]*>([\\s\\S]*?)<\\/'+tag+'>','gi'))].map(match=>text(match[1])),id);}
function number(value,label){const clean=text(value).replace(/,/g,'').replace(/원$/,'');valid(/^-?\d+(?:\.\d+)?$/.test(clean),label+' is numeric');return Number(clean);}
function control(html,id){return one(tags(html,'input').filter(tag=>tag.id===id),id+' input');}
function metadata(html,route){
  const title=one([...html.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/gi)].map(match=>text(match[1])),route+' title');
  const h1=one([...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(match=>text(match[1])),route+' H1');
  valid(title.length>0&&h1.length>0,route+' title and H1 have visible text');
  equal(meta(html,'og:title'),title,route+' Open Graph title agrees');
  const description=meta(html,'description');
  valid(description.length>0,route+' has a description');
  equal(meta(html,'og:description'),description,route+' Open Graph description agrees');
  const canonical=one(tags(html,'link').filter(tag=>tag.rel==='canonical'),route+' canonical');
  equal(canonical.href,new URL(route,origin).href,route+' keeps its canonical route');
  valid(meta(html,'robots').split(',').includes('index'),route+' remains indexable');
}
function scenario(name,run){try{run();}catch(error){failures.push({name,message:error.message});}}

const home=read('index.html');
scenario('catalog fuel basis',()=>{
  valid(Number.isFinite(catalog.gasPrice)&&catalog.gasPrice>0,'catalog has a gasoline price');
  equal(catalog.gasPrice,fuel.prices.gasoline,'catalog price agrees with the bundled fuel snapshot');
  equal(catalog.fuelPriceAsOf,fuel.price_as_of,'catalog date agrees with the bundled fuel snapshot');
  equal(manifest.fuelDate,catalog.fuelPriceAsOf,'release manifest agrees with catalog fuel date');
});
scenario('home metadata',()=>metadata(home,'/'));
const homeRows=[...home.matchAll(/<a\b[^>]*class="home-compare-row"[^>]*>[\s\S]*?<\/a>/g)].map(match=>({attributes:attributes(match[0]),html:match[0]}));
scenario('home preset count',()=>equal(homeRows.length,gasoline.length+electric.length,'home keeps the six existing presets'));
for(const match of home.matchAll(/<article\b[^>]*class="home-car"[^>]*>[\s\S]*?<\/article>/g))scenario('home vehicle card',()=>{
  const html=match[0],button=one(tags(html,'button').filter(tag=>tag['data-compare-id']),'home card compare button');
  const car=one(catalog.cars.filter(item=>item.id===button['data-compare-id']),'home card catalog entry');
  const variant=car.rep;
  if(variant.total===null){
    valid(['ev','electric'].includes(variant.fuelType),'only an electric home card needs a charging price');
    valid(text(html).includes('충전단가 입력'),'electric home card still asks for a charging price');
    return;
  }
  valid(['gasoline','hybrid'].includes(variant.fuelType),'priced home card uses gasoline');
  const tax=math.roundedTax(math.annualTax(variant.cc,false,`${catalog.taxYear}-01`,catalog.taxYear));
  valid(tax!==null,car.id+' home-card tax calculation exists');
  const energy=math.energyCost(catalog.annualKm,variant.combined,catalog.gasPrice);
  valid(energy!==null,car.id+' home-card fuel calculation exists');
  const expected=Math.round(energy)+tax.total;
  equal(variant.total,expected,car.id+' cached home-card amount uses the current fuel basis');
  const annual=one([...html.matchAll(/<dl\b[^>]*class="home-annual"[^>]*>([\s\S]*?)<\/dl>/g)].map(item=>item[1]),car.id+' home annual amount');
  const displayed=one([...annual.matchAll(/<dd\b[^>]*>\s*([\d,]+)원/g)].map(item=>number(item[1],car.id+' displayed annual amount')),car.id+' displayed annual amount');
  equal(displayed,expected,car.id+' visible home-card amount uses the current fuel basis');
});

for(const slug of [...gasoline,...electric])scenario(slug,()=>{
  const route='/compare/'+slug+'/',html=read(route.slice(1)+'index.html');
  metadata(html,route);
  const row=one(homeRows.filter(item=>new URL(item.attributes.href,origin).pathname===route),slug+' home preset');
  const homeLead=one([...row.html.matchAll(/<span\b[^>]*>([\s\S]*?)<\/span>/g)].map(match=>text(match[1])),slug+' home lead');
  const lead=innerById(html,'p','decision-saving');
  equal(homeLead,lead,slug+' home lead agrees with its destination');
  const data=JSON.parse(one([...html.matchAll(/<script\b[^>]*id="decision-data"[^>]*>([\s\S]*?)<\/script>/g)].map(match=>match[1]),slug+' decision payload'));
  const pair=one(data.pairs.filter(item=>item.slug===slug),slug+' reviewed pair');
  equal(data.pairs.length,1,slug+' static page has one reviewed pair');
  const price=number(control(html,'decision-price').value,slug+' price');
  const km=number(control(html,'decision-km').value,slug+' distance');
  equal(km,catalog.annualKm,slug+' uses the catalog distance');
  valid(tags(html,'script').some(tag=>tag.src&&new URL(tag.src,new URL(route,origin)).pathname==='/assets/cost-context.js'),slug+' preserves shared calculation inputs');

  // decision-data holds reviewed specifications and energy type, not a price
  // or date. Its sibling controls and source note hold the snapshot basis.
  if(gasoline.includes(slug)){
    equal(data.energy,'gasoline',slug+' payload identifies gasoline');
    valid([pair.left,pair.right].every(variant=>['gasoline','hybrid'].includes(variant.fuel)),slug+' reviewed pair uses gasoline');
    equal(price,catalog.gasPrice,slug+' input uses the current catalog price');
    const source=one(tags(html,'p').filter(tag=>Object.hasOwn(tag,'data-fuel-status')),slug+' fuel source');
    equal(source['data-price-date'],catalog.fuelPriceAsOf,slug+' source date agrees with catalog');
    equal(source['data-price-stale'],String(Boolean(catalog.fuelPriceStale)),slug+' source freshness agrees with catalog');
  }else{
    equal(data.energy,'electric',slug+' remains an electric comparison');
    valid([pair.left,pair.right].every(variant=>['electric','ev'].includes(variant.fuel)),slug+' keeps electric reviewed rows');
    const assumption=one([...text(html).matchAll(/([\d,.]+)원\/kWh는 비교용 초기값/g)].map(match=>number(match[1],slug+' disclosed charging assumption')),slug+' disclosed charging assumption');
    equal(price,assumption,slug+' keeps its disclosed charging-price assumption');
    equal(tags(html,'p').filter(tag=>Object.hasOwn(tag,'data-fuel-status')).length,0,slug+' does not use gasoline snapshot metadata');
  }

  const calculated=decision.compare(pair.left,pair.right,km,price);
  valid(calculated&&Number.isFinite(calculated.a.total)&&Number.isFinite(calculated.b.total),slug+' shared comparison math returns totals');
  for(const [side,variant]of [['a',pair.left],['b',pair.right]]){
    const result=calculated[side];
    const tax=math.annualTax(variant.cc,['electric','ev'].includes(variant.fuel),`${catalog.taxYear}-01`,catalog.taxYear);
    valid(tax!==null,slug+' '+side+' shared tax calculation exists');
    equal(result.tax,tax.total,slug+' '+side+' uses the catalog tax year');
    equal(number(innerById(html,'strong','decision-'+side),slug+' '+side+' total'),Math.round(result.total),slug+' '+side+' total uses shared rounding');
    equal(number(innerById(html,'dd','compare-'+side+'-energy'),slug+' '+side+' energy'),Math.round(result.energy),slug+' '+side+' energy uses shared rounding');
    equal(number(innerById(html,'dd','compare-'+side+'-tax'),slug+' '+side+' tax'),Math.round(result.tax),slug+' '+side+' tax uses shared rounding');
  }
  const difference=Math.round(calculated.a.total)-Math.round(calculated.b.total);
  if(difference===0)valid(/같음/.test(lead),slug+' zero saving says the amounts agree');
  else{
    const amount=one([...lead.matchAll(/([\d,]+)원/g)].map(match=>number(match[1],slug+' displayed difference')),slug+' displayed difference');
    equal(amount,Math.abs(difference),slug+' lead uses the difference of displayed totals');
    const cheaper=difference>0?pair.right:pair.left;
    valid(lead.includes(cheaper.model),slug+' lead names the less expensive model');
  }
  results.push({slug,energy:data.energy,price,km,leftTotal:Math.round(calculated.a.total),rightTotal:Math.round(calculated.b.total),difference});
});

console.log(JSON.stringify({build:root,checks,failures:failures.length,details:failures,presets:results}));
if(failures.length)process.exitCode=1;
