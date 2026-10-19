import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'growth-config.json'), 'utf8'));

assert.equal(config.dailyMax, 5, 'daily publishing cap should stay at five');
assert.equal(config.commercialDailyMax, 2, 'commercial posts must be capped at two per day');
assert.equal(config.utilityDailyTarget, 3, 'verified utility posts should target three per day');
assert.equal(config.maxConsecutiveCommercial, 1, 'two commercial posts must not run consecutively');
assert.deepEqual(config.slotHoursKst, [12, 18], 'commercial schedule should have two KST slots');
assert.deepEqual(config.utilitySlotHoursKst, [9, 15, 21], 'utility schedule should have three KST slots');
assert.ok(config.portfolio.utility > config.portfolio.deal, 'utility share must exceed deal share');
assert.equal(config.typeCaps.hotdeal, 2);
assert.equal(config.typeCaps.tip, 3);
assert.equal(config.merchantDailyMax, 1, 'one merchant cannot dominate the day');
assert.equal(config.topicDailyMax, 1, 'one topic cannot dominate the day');

console.log('content mix guard checks passed');
