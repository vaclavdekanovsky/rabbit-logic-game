// Game flow and DOM controls. World rules live in world/, drawing in render/,
// looks and content in config/.

import { BIOMES, SIZES } from './config/biomes.js';
import { GOALS, HEROES } from './config/entities.js';
import { Actor } from './render/actor.js';
import { loadAssets, spriteUrl } from './render/assets.js';
import { Renderer } from './render/renderer.js';
import { DIRS, generateLevel } from './world/level.js';

const $ = id => document.getElementById(id);
const boardEl = $('board');
const canvas = $('board-canvas');
const sequenceEl = $('sequence');
const modal = $('modal');

const state = {
  biomeKey: 'grass',
  sizeKey: 'easy',
  sequence: [],
  level: null,
  actor: null,
  renderer: null,
  busy: false,
  showTrail: false,
  overview: false,
  idleTimer: null,
};

const biome = () => BIOMES[state.biomeKey];

// ---------------------------------------------------------------- theme

function applyTheme() {
  const b = biome();
  const root = document.documentElement.style;
  root.setProperty('--primary', b.ui.primary);
  root.setProperty('--primary-dark', b.ui.primaryDark);
  root.setProperty('--secondary', b.ui.secondary);
  root.setProperty('--secondary-dark', b.ui.secondaryDark);
  root.setProperty('--bg-color', b.ui.bg);
  root.setProperty('--title-shadow', b.ui.titleShadow);
  $('game-title').textContent = b.text.title;
  document.querySelector('.print-title').textContent = b.text.title.replace(/\s*[^\w\s!?.,']+$/u, '');
  document.querySelectorAll('.arrow-btn .arrow-img').forEach(img => { img.src = spriteUrl(b.arrow); });
}

// ---------------------------------------------------------------- level

function newLevel() {
  if (state.busy) return;
  const b = biome();
  const seed = (Math.random() * 0x7fffffff) | 0;
  state.level = generateLevel(SIZES[state.sizeKey], b, seed);
  state.actor = new Actor(HEROES[b.hero], state.level.start);
  state.renderer = new Renderer(canvas, { biome: b, level: state.level, actor: state.actor, goalDef: GOALS[b.goal] });
  state.overview = false;
  syncMapTools();
  state.sequence = [];
  renderSequence();
  renderPrintView();
}

/** Aspect ratio and the 🔍 / 🎯 buttons follow the renderer (big maps only). */
function syncMapTools() {
  const r = state.renderer;
  boardEl.style.setProperty('--board-aspect', r.aspect);
  $('map-tools').classList.toggle('hidden', !r.scrolls);
  $('btn-overview').setAttribute('aria-pressed', state.overview);
  $('btn-recenter').disabled = state.overview;
  canvas.classList.toggle('pannable', r.scrolls && !state.overview);
}

function setOverview(on) {
  state.overview = on;
  state.renderer.setOverview(on);
  syncMapTools();
}

/** Drag the map with a mouse or finger to look around; it glides back to the hero by itself. */
function setupPan() {
  let drag = null;
  const r = () => state.renderer;
  canvas.addEventListener('pointerdown', e => {
    if (state.busy || state.overview || !r().scrolls) return;
    drag = { x: e.clientX, y: e.clientY };
    r().dragging = true;
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('grabbing');
  });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    const cells = r().view.w / canvas.clientWidth; // cells per CSS pixel
    r().panBy(-(e.clientX - drag.x) * cells, -(e.clientY - drag.y) * cells);
    drag = { x: e.clientX, y: e.clientY };
  });
  const end = () => {
    if (!drag) return;
    drag = null;
    r().dragging = false;
    r().lastLook = performance.now();
    canvas.classList.remove('grabbing');
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
}

function resetLevel() {
  state.sequence = [];
  state.actor.place(state.level.start);
  state.renderer.goalVisible = true;
  renderSequence();
}

// ---------------------------------------------------------------- sequence + trail

function renderSequence() {
  const arrow = spriteUrl(biome().arrow);
  sequenceEl.innerHTML = '';
  state.sequence.forEach((dir, index) => {
    const item = document.createElement('div');
    item.className = 'seq-item';
    item.innerHTML = `<img src="${arrow}" class="arrow-img dir-${dir}" />`;
    item.addEventListener('click', () => {
      if (state.busy) return;
      state.sequence.splice(index, 1);
      renderSequence();
    });
    sequenceEl.appendChild(item);
  });
  sequenceEl.scrollLeft = sequenceEl.scrollWidth; // keep the newest arrow in view
  updateTrail();
}

function addMove(dir) {
  if (state.busy) return;
  state.sequence.push(dir);
  renderSequence();
}

function undoMove() {
  if (state.busy) return;
  state.sequence.pop();
  renderSequence();
}

/** Preview of where the current sequence leads (same rules as the real run). */
function updateTrail() {
  const { level, renderer } = state;
  if (!renderer) return;
  renderer.trail = [];
  if (!state.showTrail || state.busy) return;
  let { x, y } = level.start;
  const prints = [];
  let kind = 'plain';
  for (const dir of state.sequence) {
    const d = DIRS[dir];
    const nx = x + d.dx, ny = y + d.dy;
    if (!level.canMove(x, y, nx, ny)) { prints.push({ x: nx, y: ny, angle: d.angle }); kind = 'error'; break; }
    x = nx; y = ny;
    prints.push({ x, y, angle: d.angle });
    if (x === level.goal.x && y === level.goal.y) { kind = 'success'; break; }
  }
  renderer.trail = prints.map(p => ({ ...p, kind }));
}

async function runSequence() {
  if (!state.sequence.length || state.busy) return;
  const { level, actor, renderer } = state;
  const text = biome().text;
  state.busy = true;
  if (state.overview) setOverview(false); // follow the hero while it walks
  renderer.recenter();
  updateTrail();
  actor.place(level.start);
  let { x, y } = level.start;

  await actor.begin();
  for (const dir of state.sequence) {
    const d = DIRS[dir];
    const nx = x + d.dx, ny = y + d.dy;
    if (!level.canMove(x, y, nx, ny)) {
      await actor.bump(d.dx, d.dy);
      await actor.end('dizzy');
      return finish('Oops!', level.propAt(nx, ny)?.def.bumpMsg ?? text.bump, false);
    }
    await actor.stepTo(nx, ny);
    x = nx; y = ny;
    if (x === level.goal.x && y === level.goal.y) {
      await actor.end('win');
      renderer.goalVisible = false;
      return finish('YAY!', text.win, true);
    }
  }
  await actor.end('dizzy');
  finish('Hmm...', text.short, false);
}

function finish(title, msg, isWin) {
  state.busy = false;
  const art = HEROES[biome().hero].art;
  $('modal-title').textContent = title;
  $('modal-title').style.color = isWin ? 'var(--primary-dark)' : 'var(--secondary-dark)';
  $('modal-msg').textContent = msg;
  const img = $('modal-img');
  img.src = spriteUrl(heroStill(art, isWin ? 'win' : 'dizzy'));
  img.style.display = 'block';
  modal.classList.remove('hidden');
  const close = $('btn-modal-close');
  close.textContent = isWin ? 'Play Again' : 'Try Again';
  close.onclick = () => {
    modal.classList.add('hidden');
    if (isWin) newLevel(); else resetLevel();
  };
}

function heroStill(art, pose) {
  try { return spriteUrl(`${art}_${pose}`) && `${art}_${pose}`; } catch { return `${art}_idle`; }
}

// ---------------------------------------------------------------- print

function renderPrintView() {
  const { level, renderer } = state;
  const arrow = spriteUrl(biome().arrow);
  renderer.draw(0, 1);
  $('print-grid').innerHTML = `<img class="print-board" src="${canvas.toDataURL('image/png')}" />`;

  const order = ['up', 'down', 'left', 'right'];
  $('print-path').innerHTML = order
    .flatMap(dir => level.solution.filter(d => d === dir))
    .map(dir => `<img src="${arrow}" class="dir-${dir}" />`).join('');
  $('print-arrows').innerHTML = Array.from({ length: 6 }, () =>
    order.map(dir => `<div class="print-cutout"><img src="${arrow}" class="dir-${dir}" /></div>`).join('')).join('');
}

// ---------------------------------------------------------------- idle -> sleep

function resetIdle() {
  const { actor } = state;
  if (actor?.state === 'sleep') actor.state = 'idle';
  clearTimeout(state.idleTimer);
  state.idleTimer = setTimeout(() => {
    if (!state.busy && state.actor.state === 'idle') state.actor.state = 'sleep';
  }, 5000);
}

// ---------------------------------------------------------------- wiring

function selectButtons(selector, onPick) {
  const buttons = document.querySelectorAll(selector);
  buttons.forEach(btn => btn.addEventListener('click', () => {
    if (state.busy) return;
    buttons.forEach(b => b.classList.toggle('active', b === btn));
    onPick(btn);
  }));
}

function setupEvents() {
  ['click', 'mousemove', 'keydown'].forEach(evt => document.addEventListener(evt, resetIdle));
  selectButtons('.theme-btn', btn => { state.biomeKey = btn.dataset.theme; applyTheme(); newLevel(); });
  selectButtons('.diff-btn', btn => { state.sizeKey = btn.dataset.size; newLevel(); });
  $('btn-new').addEventListener('click', newLevel);
  $('btn-print').addEventListener('click', () => { renderPrintView(); window.print(); });
  $('btn-go').addEventListener('click', runSequence);
  $('btn-overview').addEventListener('click', () => { if (!state.busy) setOverview(!state.overview); });
  $('btn-recenter').addEventListener('click', () => state.renderer.recenter());
  setupPan();

  const btnTrail = $('btn-trail');
  btnTrail.addEventListener('click', () => {
    state.showTrail = !state.showTrail;
    btnTrail.classList.toggle('on', state.showTrail);
    btnTrail.setAttribute('aria-pressed', state.showTrail);
    updateTrail();
  });

  document.querySelectorAll('.arrow-btn').forEach(btn => btn.addEventListener('click', () => addMove(btn.dataset.dir)));
  $('btn-undo').addEventListener('click', undoMove);
  $('btn-clear').addEventListener('click', () => { if (!state.busy) { state.sequence = []; renderSequence(); } });

  const keys = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
  document.addEventListener('keydown', e => {
    if (state.busy || !modal.classList.contains('hidden')) return;
    if (keys[e.key]) { addMove(keys[e.key]); e.preventDefault(); }
    else if (e.key === 'Enter') runSequence();
    else if (e.key === 'Backspace') undoMove();
  });
}

function loop() {
  let last = performance.now();
  const frame = now => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    state.actor.update(dt);
    state.renderer.draw(now / 1000, dt);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

async function start() {
  await loadAssets();
  applyTheme();
  setupEvents();
  newLevel();
  resetIdle();
  loop();
  if (import.meta.env.DEV) window.__game = state; // handy for debugging in the console
}

start();
