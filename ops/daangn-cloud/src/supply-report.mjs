import fs from 'node:fs/promises';
import { kstDay } from './growth-engine.mjs';
const read = async (name, fallback) => { try { return JSON.parse(await fs.readFile(name, 'utf8')); } catch { return fallback; } };
const [report, published, config, queue] = await Promise.all([read('state/editorial-report.json',{}),read('state/published.json',[]),read('growth-config.json',{}),read('state/queue.json',[])]);
const day=kstDay();
const count=published.filter(x=>x.status==='published' && kstDay(new Date(x.publishedAt))===day).length;
const remaining=Math.max(0,(config.dailyMax || 15)-count);
const lines=[`### 당근 발행 현황 (${day}, KST)`, '', `실제 발행: **${count}/${config.dailyMax || 15}건**`, `이번 실행: ${report.mode || 'unknown'}`, `검증 후보: ${queue.length}건 / 목표까지 부족: ${remaining}건`, '', ...((report.collection || []).map(x=>`- ${x.source}: ${x.count || 0}건${x.failures?.length ? `, 실패/보류 ${x.failures.length}건` : ''}`))];
if(queue.length < remaining) { lines.push('', '**공급 부족: 일일 목표 달성을 보장할 수 없는 상태입니다.**'); console.log('::warning::DAANGN_SUPPLY_SHORTAGE published='+count+' target='+config.dailyMax+' candidates='+queue.length); }
if(process.env.GITHUB_STEP_SUMMARY) await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,lines.join('\n')+'\n');
console.log(lines.join('\n'));
