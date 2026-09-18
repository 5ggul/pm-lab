import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const workflow=fs.readFileSync(path.join(repo,'.github/workflows/franchise-release-rehearsal.yml'),'utf8');
const browser=fs.readFileSync(path.join(here,'production-candidate-browser.mjs'),'utf8');

function includesAll(text,needles){for(const needle of needles)assert.ok(text.includes(needle),`Missing safety contract: ${needle}`)}

test('release rehearsal checks out the exact PR head and has read-only repository permissions',()=>{
  includesAll(workflow,[
    'name: franchise-release-rehearsal',
    'permissions:\n  contents: read',
    'ref: ${{ github.event.pull_request.head.sha || github.sha }}',
    'persist-credentials: false',
    'test "$(git rev-parse HEAD)" = "$SSG_QA_SOURCE_SHA"'
  ]);
});

test('release rehearsal is test-mode only and never supplies production approvals',()=>{
  includesAll(workflow,[
    "SSG_RELEASE_TEST_MODE: 'true'",
    'test -z "${SSG_RELEASE_BUILD_APPROVED:-}"',
    'test -z "${SSG_PRODUCTION_DEPLOY_APPROVED:-}"',
    'name: Revalidate and destroy rehearsal candidate',
    'if: always()',
    "SSG_RELEASE_TEST_CLEANUP: 'true'",
    'rm -rf "$SSG_PRODUCTION_OUTPUT"',
    'test ! -e "$SSG_PRODUCTION_OUTPUT"'
  ]);
  assert.ok(!/^\s*SSG_RELEASE_BUILD_APPROVED:\s*YES\s*$/m.test(workflow));
  assert.ok(!/^\s*SSG_PRODUCTION_DEPLOY_APPROVED:\s*(YES|true)\s*$/mi.test(workflow));
  assert.ok(!/uses:\s*(netlify|vercel)\//i.test(workflow));
  assert.ok(!/\b(deploy|publish)\b[^\n]*production/i.test(workflow));
});

test('release rehearsal executes the strict input contract and proves placeholders stay blocked',()=>{
  includesAll(workflow,[
    'franchise-ssg-core/release-input-contract.test.mjs',
    'franchise-ssg-core/release-provenance.test.mjs',
    'name: Prove placeholder release inputs stay blocked',
    'SSG_RELEASE_CONFIG=franchise-ssg-core/release-config.example.json',
    'node franchise-ssg-core/run-validate-release-inputs.mjs',
    'test "$code" -eq 2'
  ]);
});

test('release rehearsal seals exact candidate bytes and never grants second approval',()=>{
  includesAll(workflow,[
    'SSG_PRODUCTION_SEAL=$RUNNER_TEMP/franchise-release-rehearsal/production-candidate-seal.json',
    'node franchise-ssg-core/run-seal-production-candidate.mjs',
    'name: Prove sealed candidate stays blocked without second approval',
    'test -z "${SSG_PRODUCTION_DEPLOY_DIGEST:-}"',
    'test -z "${SSG_PRODUCTION_DEPLOY_SOURCE_SHA:-}"',
    'node franchise-ssg-core/run-verify-production-deploy-gate.mjs',
    "grep -q 'BLOCKED_SECOND_APPROVAL_REQUIRED'"
  ]);
  assert.ok(!/^\s*SSG_PRODUCTION_DEPLOY_DIGEST:\s*\S+/m.test(workflow));
  assert.ok(!/^\s*SSG_PRODUCTION_DEPLOY_SOURCE_SHA:\s*\S+/m.test(workflow));
});

test('browser rehearsal is pinned to loopback plus the reserved invalid origin',()=>{
  includesAll(browser,[
    "const productionOrigin='https://franchise-release-contract.invalid'",
    "['127.0.0.1','localhost','[::1]'].includes(base.hostname)",
    "assert.equal(build.testMode,true",
    "assert.equal(build.decision,'PRODUCTION_CANDIDATE_BUILT_NOT_DEPLOYED'",
    "assert.equal(build.productionSite,'RESERVED_TEST_ORIGIN'",
    "assert.equal(expectedUrl.origin,productionOrigin",
    "if(effective.has(route))assert.equal(expectedHref,canonicalHref(selfCanonical(route))",
    "assert.equal(canonicalHref(dom.canonical),expectedHref",
    "realProductionDomainUsed:false",
    "productionDeploy:false",
    "assert.equal(htmlFiles.length,311",
    "assert.equal(build.requestedCandidateCount,184"
  ]);
  assert.ok(!browser.includes('SSG_RELEASE_BUILD_APPROVED=YES'));
});

test('rehearsal persists route-level diagnostics before failing the browser gate',()=>{
  includesAll(browser,[
    "console.error('ROUTE_FAIL '",
    "console.error('KEY_ROUTE_FAIL '",
    "console.error('FAILED_CASES '",
    "failedCases:failed",
    "persistEvidence(output)",
    "assert.equal(failed.length,0,'All production rehearsal routes must render')"
  ]);
});

test('rehearsal verifies transformed crawl/index policy and legal replacements before cleanup',()=>{
  includesAll(workflow,[
    'run-finalize-production-index-policy.mjs',
    'run-audit-production-seo.mjs',
    'run-validate-production-candidate.mjs',
    'production-candidate-browser.mjs',
    'run-validate-v11-53-release-handoff.mjs',
    'run-validate-v11-52-release-candidate.mjs'
  ]);
  includesAll(browser,[
    "const noindex='noindex,nofollow,noarchive,nosnippet'",
    "const expectedRobots=effective.has(route)?'index,follow':noindex",
    "assert.equal(canonicalHref(dom.canonical),expectedHref,'Browser canonical URL must equal transformed production HTML')",
    "Sitemap: ${productionOrigin}/sitemap.xml",
    "['/about/'",
    "'/contact/'",
    "'/privacy/'",
    "'/terms/'",
    "release-contract@example.invalid",
    "계약 테스트 개인정보처리방침",
    "계약 테스트 이용약관"
  ]);
});
