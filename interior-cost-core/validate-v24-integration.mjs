import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve('docs/interior-cost-preview');
const read=r=>fs.readFileSync(path.join(ROOT,r),'utf8');
const json=(r,f={})=>{try{return JSON.parse(read(r))}catch{return f}};
const exists=r=>fs.existsSync(path.join(ROOT,r));
const VERSION='24.0.0';
const pyeongs=[24,30,32,34,40];

const release23=json('data/release-url-set-v23.json',{});
const gate23=json('data/matrix-release-gate-v23.json',{});
const quote=json('data/v22-quote-lines-config.json',{});
const quoteAudit=json('data/v22-quote-lines-audit.json',{});
const importer=json('data/v23-quote-import-config.json',{});
const importAudit=json('data/v23-quote-import-audit.json',{});
const quotePage=exists('compare/quote-lines/index.html')?read('compare/quote-lines/index.html'):'';
const matrixHub=exists('interior-cost/matrix/index.html')?read('interior-cost/matrix/index.html'):'';
const llms=exists('llms.txt')?read('llms.txt'):'';

const insulation=pyeongs.map(p=>{
  const route=`interior-cost/matrix/${p}-pyeong/insulation/index.html`;
  const html=exists(route)?read(route):'';
  return {
    pyeong:p,route,exists:Boolean(html),
    noindex:html.includes('noindex,nofollow'),
    marker:html.includes('data-v23-insulation'),
    faq:html.includes('data-v23-faq-list'),
    refs:(html.match(/OD020\./g)||[]).length
  };
});

const checks={
  v23_release_set_100:Number(release23.total_count)===100,
  v23_release_simulation_only:release23.simulation_only===true,
  v23_gate_present:Object.keys(gate23).length>0,
  five_insulation_routes:insulation.every(x=>x.exists&&x.noindex&&x.marker&&x.faq&&x.refs>=8),
  quote_config_v22:quote.version==='22.0.0'&&Array.isArray(quote.trades)&&quote.trades.length===5,
  quote_reference_depth:Object.keys(quote.references||{}).length>=300,
  quote_same_unit_only:quote.rules?.same_unit_candidates_only===true,
  quote_no_cross_source_sum:quote.rules?.cross_source_auto_sum===false,
  quote_page_noindex:quotePage.includes('noindex,nofollow'),
  quote_page_importer:quotePage.includes('data-v23-import')&&quotePage.includes('data-v22-tool'),
  quote_v23_bundles:quotePage.includes('site-v23-bundle.css')&&quotePage.includes('app-v23-bundle.js'),
  importer_v23:importer.version==='23.0.0'&&Number(importer.max_rows)===12,
  importer_formats:['paste-text','csv','tsv','txt-file','csv-file','tsv-file'].every(x=>(importer.accepted||[]).includes(x)),
  importer_client_only:importer.rules?.client_side_only===true&&importer.rules?.upload_to_server===false,
  importer_no_auto_reference:importer.rules?.auto_select_official_reference===false&&importer.rules?.auto_confirm_scope===false,
  prior_quote_gate_pass:Object.values(quoteAudit.checks||{}).every(v=>v===true),
  prior_import_gate_pass:Object.values(importAudit.checks||{}).every(v=>v===true),
  matrix_hub_keeps_quote_entry:matrixHub.includes('data-v22-quote-lines-entry')&&matrixHub.includes('/compare/quote-lines/'),
  matrix_hub_noindex:matrixHub.includes('noindex,nofollow'),
  llms_keeps_quote_surface:llms.includes('## v22 multi-line quote comparison')&&llms.includes('/compare/quote-lines/'),
  preview_has_no_cname:!exists('CNAME'),
  no_production_switch:quoteAudit.production_switch===false&&importAudit.production_switch===false,
  no_search_console_submit:quoteAudit.search_console_submission===false&&importAudit.search_console_submission===false,
  no_ads_injected:quoteAudit.ads_injected===false&&importAudit.ads_injected===false
};

const failed=Object.entries(checks).filter(([,v])=>v!==true).map(([k])=>k);
const audit={
  version:VERSION,
  generated_at:new Date().toISOString(),
  sources:{matrix:'v23 insulation reference closure',quote:'v23 quote import hardened'},
  release_candidate_count:Number(release23.total_count||0),
  quote_reference_count:Object.keys(quote.references||{}).length,
  insulation,
  checks,
  failed,
  production_switch:false,
  search_console_submission:false,
  ads_injected:false,
  merge_to_main:false
};
fs.writeFileSync(path.join(ROOT,'data/v24-integration-audit.json'),JSON.stringify(audit,null,2));
if(failed.length)throw new Error(`v24 integration gate failed: ${failed.join(', ')}`);
console.log(JSON.stringify({version:VERSION,release_candidate_count:audit.release_candidate_count,quote_reference_count:audit.quote_reference_count,checks},null,2));
