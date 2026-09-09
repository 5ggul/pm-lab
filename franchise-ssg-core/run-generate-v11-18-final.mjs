import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const generatedAt=new Date().toISOString();
const compareReportPath=path.join(out,'v11-17-compare-trust.json');
const manifestPath=path.join(out,'route-manifest.json');
const qualityPath=path.join(out,'v11-quality-report.json');
const compareReport=JSON.parse(await fs.readFile(compareReportPath,'utf8'));
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
const quality=JSON.parse(await fs.readFile(qualityPath,'utf8'));

const sectionRe=/<section class="block compare-next" data-v11-17-compare-next="1"(?: data-v11-18-page-level="1")?>[\s\S]*?<\/section>/g;
const fixed=[];

for(const row of compareReport.eligible||[]){
  const file=path.join(out,...row.route.split('/').filter(Boolean),'index.html');
  let html=await fs.readFile(file,'utf8');
  const sections=html.match(sectionRe)||[];
  if(sections.length!==1)throw new Error(`${row.route}: expected exactly one compare-next section before relocation, got ${sections.length}`);
  let section=sections[0].replace('data-v11-17-compare-next="1"','data-v11-17-compare-next="1" data-v11-18-page-level="1"');
  html=html.replace(sectionRe,'');
  const lastOuterClose=html.lastIndexOf('</article>');
  if(lastOuterClose<0)throw new Error(`${row.route}: outer article close not found`);
  const sourcePos=html.lastIndexOf('<section class="block"><h2>출처</h2>');
  if(sourcePos<0)throw new Error(`${row.route}: source section anchor not found`);
  if(lastOuterClose<sourcePos)throw new Error(`${row.route}: outer article close precedes source section`);
  html=html.slice(0,lastOuterClose)+section+html.slice(lastOuterClose);
  await fs.writeFile(file,html,'utf8');
  fixed.push(row.route);
}

manifest.uiVersion='11.18';
manifest.v11_18={compareContextPlacementFix:true,eligibleComparePagesFixed:fixed.length,placementRule:'AFTER_SOURCE_SECTION_BEFORE_OUTERMOST_ARTICLE_CLOSE'};
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2),'utf8');
quality.contentTrust={...(quality.contentTrust||{}),version:'11.18',generatedAt,compareContextPlacementFix:true,compareContextPlacementRule:'AFTER_SOURCE_SECTION_BEFORE_OUTERMOST_ARTICLE_CLOSE'};
await fs.writeFile(qualityPath,JSON.stringify(quality,null,2),'utf8');
const report={schemaVersion:1,generatedAt,uiVersion:'11.18',previewMode:compareReport.previewMode,policy:'COMPARE_NEXT_MUST_BE_PAGE_LEVEL_AFTER_SOURCE_AND_BEFORE_OUTERMOST_ARTICLE_CLOSE; NEVER_INSIDE_MOBILE_COMPARE_CARD',fixedCount:fixed.length,fixedRoutes:fixed,productionCandidateCount:compareReport.productionCandidateCount};
await fs.writeFile(path.join(out,'v11-18-compare-placement.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({v11_18:'PASS',fixedCount:fixed.length,productionCandidates:report.productionCandidateCount},null,2));
