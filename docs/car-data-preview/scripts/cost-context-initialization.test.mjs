import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const runtime = fs.readFileSync(new URL('../assets/cost-context.js', import.meta.url), 'utf8');

function fixture({readyState = 'loading', family = false} = {}) {
  const timers = [], microtasks = [], observers = [], events = [], resetLinks = [];
  let doc;
  class Event {
    constructor(type, options = {}) { this.type = type; this.bubbles = Boolean(options.bubbles); this.isTrusted = false; }
  }
  class Target {
    constructor(id = '') { this.id = id; this.listeners = new Map(); }
    addEventListener(type, listener) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(listener);
    }
    dispatchEvent(event) {
      event.target ||= this;
      for (const listener of [...this.listeners.get(event.type) || []]) listener(event);
      if (event.bubbles && this !== doc) doc.dispatchEvent(event);
      return true;
    }
  }
  const makeControl = (id, value) => Object.assign(new Target(id), {
    value, disabled: false, tagName: 'INPUT', dataset: {}, style: {},
    min: '', max: '', options: [], textContent: '',
    closest() { return {append: element => resetLinks.push(element)}; }
  });
  const registration = makeControl(family ? 'reg' : 'regDate', '2026-01');
  registration.min = family ? '1900-01' : '2022-11'; registration.max = '2026-12';
  const distance = makeControl(family ? 'km' : 'annualKm', '20000');
  const controls = new Map([['#' + registration.id, registration], ['#' + distance.id, distance]]);
  if (family) {
    controls.set('#familySearch', makeControl('familySearch', '기아 쏘렌토'));
    controls.set('#sourceRow', makeControl('sourceRow', ''));
    controls.set('#priceLabelText', {textContent: '휘발유 가격 (원/L)'});
  }
  doc = Object.assign(new Target(), {
    readyState, body: {dataset: {}}, documentElement: {dataset: {}},
    querySelector(selector) {
      for (const item of selector.split(',')) if (controls.has(item)) return controls.get(item);
      return null;
    },
    createElement(tag) { return makeControl(tag, ''); }
  });
  const location = new URL('https://peekmycar.com/' + (family ? 'tools/annual-cost/' : 'cars/hyundai/grandeur-gn7/') + '?km=12000&reg=2023-07');
  const browser = new Target();
  class MutationObserver {
    constructor(callback) { this.callback = callback; this.active = false; observers.push(this); }
    observe() { this.active = true; }
    disconnect() { this.active = false; }
  }
  const context = vm.createContext({
    document: doc, window: browser, location, URL, URLSearchParams, Event, MutationObserver,
    setTimeout(callback, delay) { assert.equal(delay, 0); timers.push(callback); },
    queueMicrotask(callback) { microtasks.push(callback); },
    history: {state: null, replaceState(state, title, href) { location.href = new URL(href, location).href; }}
  });
  const bindRenderer = () => registration.addEventListener('change', () => events.push({value: registration.value}));
  return {
    doc, registration, distance, controls, events, resetLinks,
    start() { vm.runInContext(runtime, context); },
    bindRenderer,
    mutation() { for (const observer of observers) if (observer.active) observer.callback([]); },
    ready() { doc.readyState = 'interactive'; doc.dispatchEvent(new Event('DOMContentLoaded')); },
    notifyReady() { doc.dispatchEvent(new Event('car-cost-context-change')); },
    flush() {
      while (timers.length) { timers.shift()(); while (microtasks.length) microtasks.shift()(); }
      while (microtasks.length) microtasks.shift()();
    },
    observerActive: () => observers.some(observer => observer.active),
    timerCount: () => timers.length
  };
}

test('early mutations cannot consume URL restoration before the detail renderer binds its listeners', () => {
  const page = fixture();
  page.start();
  page.mutation();
  assert.equal(page.registration.value, '2026-01');
  assert.equal(page.distance.value, '20000');
  assert.deepEqual(page.events, []);
  assert.equal(page.observerActive(), true);

  // Deliberately register the renderer after the runtime's DOMContentLoaded
  // callback. Restoration still has to run after all event listeners finish.
  page.doc.addEventListener('DOMContentLoaded', page.bindRenderer);
  page.ready();
  assert.equal(page.registration.value, '2026-01');
  assert.equal(page.timerCount(), 1);
  page.mutation();
  assert.deepEqual(page.events, []);
  page.flush();
  assert.equal(page.registration.value, '2023-07');
  assert.equal(page.distance.value, '12000');
  assert.deepEqual(page.events, [{value: '2023-07'}]);
  assert.equal(page.resetLinks.length, 1);
  assert.equal(page.observerActive(), false);

  page.mutation(); page.notifyReady(); page.flush();
  assert.deepEqual(page.events, [{value: '2023-07'}], 'later events must not apply the initial URL twice');
  assert.equal(page.resetLinks.length, 1);
});

test('an initialized document still waits for asynchronous family options before applying URL conditions once', () => {
  const page = fixture({family: true});
  page.start(); page.bindRenderer(); page.ready(); page.flush();
  assert.equal(page.registration.value, '2026-01');
  assert.deepEqual(page.events, []);
  assert.equal(page.observerActive(), true);

  page.doc.documentElement.dataset.costMode = 'all';
  page.mutation();
  assert.equal(page.registration.value, '2026-01', 'mode alone is not enough without source options');
  page.controls.get('#sourceRow').options = [{value: 'reviewed-row'}];
  page.controls.get('#sourceRow').value = 'reviewed-row';
  page.notifyReady(); page.flush();
  assert.equal(page.registration.value, '2023-07');
  assert.equal(page.distance.value, '12000');
  assert.deepEqual(page.events, [{value: '2023-07'}]);
  assert.equal(page.observerActive(), false);
  page.notifyReady(); page.flush();
  assert.equal(page.events.length, 1);
});

test('a runtime loaded after the document is complete restores immediately without waiting for an event that already fired', () => {
  const page = fixture({readyState: 'complete'});
  page.bindRenderer();
  page.start();
  assert.equal(page.timerCount(), 0);
  assert.equal(page.registration.value, '2023-07');
  assert.equal(page.distance.value, '12000');
  assert.deepEqual(page.events, [{value: '2023-07'}]);
  assert.equal(page.resetLinks.length, 1);
  assert.equal(page.observerActive(), false);
});
