import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

const config = JSON.parse(await fs.readFile(new URL('../growth-config.json', import.meta.url), 'utf8'));
const workflow = await fs.readFile(new URL('../../../.github/workflows/daangn-cloud.yml', import.meta.url), 'utf8');

function sorted(values) {
  return [...values].sort((a, b) => a - b);
}

function parsePrimarySchedule(text) {
  const match = text.match(/^\s*-\s+cron:\s*["']([^"']+)["']/m);
  assert.ok(match, 'daangn-cloud workflow must define a scheduled cron trigger');
  const fields = match[1].trim().split(/\s+/);
  assert.equal(fields.length, 5, 'cron expression must contain five fields');
  return {
    minutes: fields[0].split(',').map(Number),
    utcHours: fields[1].split(',').map(Number),
    dayOfMonth: fields[2],
    month: fields[3],
    dayOfWeek: fields[4]
  };
}

test('workflow cron mirrors configured KST publishing slots', () => {
  const schedule = parsePrimarySchedule(workflow);
  assert.deepEqual(schedule.minutes, [7, 37]);
  assert.equal(schedule.dayOfMonth, '*');
  assert.equal(schedule.month, '*');
  assert.equal(schedule.dayOfWeek, '*');

  const actualKstHours = schedule.utcHours.map(hour => (hour + 9) % 24);
  assert.equal(new Set(actualKstHours).size, actualKstHours.length, 'workflow cron must not contain duplicate KST slots');
  assert.deepEqual(sorted(actualKstHours), sorted(config.slotHoursKst));
});

test('production volume contract remains explicit', () => {
  assert.equal(config.baseDailyTarget, 5);
  assert.equal(config.dailyMax, 9);
  assert.equal(config.commercialDailyMax, 3);
  assert.equal(config.utilityDailyTarget, 4);
});
