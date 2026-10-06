import fs from 'node:fs/promises';
import { kstDay } from './growth-engine.mjs';
const read = async (name, fallback) => { try { return JSON.parse(await fs.readFile(name, 'utf8')); } catch { return fallback; } };
const [report, published, config, queue] = await Promise.all([read('state/editorial-report.json',{}),read('state/published.json',[]),read('growth-config.json',{}),read('state/queue.json',[])]);
const day=kstDay();
const count=published.filter(x=>x.status==='published' && kstDay(new Date(x.publishedAt))===day).length;
const remaining=Math.max(0,(config.dailyMax ?? 5)-count);
const selectionReady=(report.previews || []).filter(x=>x.selectionReady).length;
const copyRejected=(report.previews || []).filter(x=>x.rejected).length;
const floor=report.copyQualityFloor ?? config.minCopyQuality ?? 0;
const lines=[
  `### 당근 발행 현황 (${day}, KST)`,
  '',
  `실제 발행: **${count}건 / 일일 상한 ${config.dailyMax ?? 5}건**`,
  `이번 실행: ${report.mode || 'unknown'}`,
  `검증 후보: ${queue.length}건 / 최종 선택 가능: ${selectionReady}건 / 카피 탈락: ${copyRejected}건`,
  `최종 카피 품질 하한: ${floor}점 / 남은 발행 가능량: ${remaining}건`,
  selectionReady === 0 && queue.length
    ? '경고: 큐는 있지만 최종 선택 가능한 후보가 0건입니다. 카피 점수/중복/카테고리 필터를 확인하세요.'
    : '품질을 통과한 후보만 발행하며 상한을 억지로 채우지 않습니다.',
  '',
  ...((report.collection || []).map(x=>`- ${x.source}: ${x.count || 0}건${x.failures?.length ? `, 실패/보류 ${x.failures.length}건` : ''}`))
];
if(process.env.GITHUB_STEP_SUMMARY) await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,lines.join('\n')+'\n');
console.log(lines.join('\n'));
