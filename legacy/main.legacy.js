import { THEMES } from './src/themes.js';

// Game State
let currentThemeKey = 'grass';
let currentBoardMode = 'tiles'; // 'scenery' (Option 1: Big Image) | 'tiles' (Option 2: Seamless + Stepping Tiles)
let currentDiff = 'easy';
let sequence = [];
let grid = [];
let rabbitPos = { x: 0, y: 0 };
let carrotPos = { x: 3, y: 3 };
let gridSize = 4;
let isAnimating = false;
let recommendedPath = [];
let isEating = false;
let showTrail = false;

// Idle Timer State
let idleTimer = null;
let isSleeping = false;

function getTheme() {
  return THEMES[currentThemeKey] || THEMES.grass;
}

function applyThemeToDOM() {
  const theme = getTheme();
  const root = document.documentElement;

  root.style.setProperty('--primary', theme.colors.primary);
  root.style.setProperty('--primary-dark', theme.colors.primaryDark);
  root.style.setProperty('--secondary', theme.colors.secondary);
  root.style.setProperty('--secondary-dark', theme.colors.secondaryDark);
  root.style.setProperty('--bg-color', theme.colors.bgColor);
  root.style.setProperty('--title-shadow', theme.colors.titleShadow);
  root.style.setProperty('--tile-bg', `url('${theme.tileBg}')`);
  root.style.setProperty('--board-bg', `url('${theme.boardBg}')`);
  root.style.setProperty('--border-overlay', `url('${theme.borderOverlay}')`);
  root.style.setProperty('--stream-filter', theme.streamFilter);
  root.style.setProperty('--cell-border', theme.colors.cellBorder);
  root.style.setProperty('--cell-highlight', theme.colors.cellHighlight);
  root.style.setProperty('--cell-shadow', theme.colors.cellShadow);
  root.style.setProperty('--cell-even-tint', theme.colors.cellEvenTint);
  root.style.setProperty('--cell-odd-tint', theme.colors.cellOddTint);

  applyBoardModeToDOM();

  const titleEl = document.getElementById('game-title');
  if (titleEl) titleEl.textContent = theme.title;

  const printTitleEl = document.querySelector('.print-title');
  if (printTitleEl) printTitleEl.textContent = theme.printTitle;

  document.querySelectorAll('.arrow-btn .arrow-img').forEach(img => {
    img.src = theme.arrow;
  });
}

function applyBoardModeToDOM() {
  const printGrid = document.getElementById('print-grid');
  [gridEl, printGrid].forEach(el => {
    if (!el) return;
    el.classList.remove('board-mode-scenery', 'board-mode-tiles');
    el.classList.add(`board-mode-${currentBoardMode}`);
  });
}

function setRabbitSleeping(sleep) {
  if (isAnimating || isEating) return;
  isSleeping = sleep;
  const theme = getTheme();
  const rabbitImg = document.querySelector('.rabbit-img');
  if (rabbitImg) {
    if (sleep) {
      rabbitImg.src = theme.hero.sleeping;
      rabbitImg.style.transform = 'scaleX(1)';
    } else {
      rabbitImg.src = theme.hero.idle;
    }
  }
}

function startIdleTimer() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    setRabbitSleeping(true);
  }, 5000);
}

function resetIdle() {
  if (isSleeping) setRabbitSleeping(false);
  startIdleTimer();
}

const diffSettings = {
  easy: { obstacles: 2, size: 4 },
  medium: { obstacles: 4, size: 4 },
  hard: { obstacles: 8, size: 5 } // 5x5 grid gets more obstacles
};

// DOM Elements
const gridEl = document.getElementById('grid');
const sequenceEl = document.getElementById('sequence');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalMsg = document.getElementById('modal-msg');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  applyThemeToDOM();
  setupEventListeners();
  initGame();
});

function setupEventListeners() {
  ['click', 'mousemove', 'keydown'].forEach(evt => {
    document.addEventListener(evt, resetIdle);
  });
  startIdleTimer();

  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (isAnimating) return;
      document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
      const targetBtn = e.currentTarget;
      targetBtn.classList.add('active');
      currentThemeKey = targetBtn.dataset.theme;
      applyThemeToDOM();
      initGame();
    });
  });

  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      const targetBtn = e.currentTarget;
      targetBtn.classList.add('active');
      currentBoardMode = targetBtn.dataset.mode;
      applyBoardModeToDOM();
    });
  });

  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (isAnimating) return;
      document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentDiff = e.target.id.replace('btn-', '');
      initGame();
    });
  });

  document.getElementById('btn-new').addEventListener('click', initGame);

  const btnTrail = document.getElementById('btn-trail');
  if (btnTrail) {
    btnTrail.addEventListener('click', () => {
      showTrail = !showTrail;
      btnTrail.textContent = `🐾 Show Trail: ${showTrail ? 'ON' : 'OFF'}`;
      btnTrail.style.backgroundColor = showTrail ? '#10b981' : '#f59e0b';
      btnTrail.style.boxShadow = showTrail ? '0 4px 0 #059669' : '0 4px 0 #d97706';
      renderTrail();
    });
  }

  document.getElementById('btn-print').addEventListener('click', () => {
    window.print();
  });

  document.querySelectorAll('.arrow-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (isAnimating) return;
      const dir = e.target.closest('button').dataset.dir;
      sequence.push(dir);
      renderSequence();
    });
  });

  document.getElementById('btn-go').addEventListener('click', runSequence);
}

function initGame() {
  if (isAnimating) return;
  sequence = [];
  isEating = false;
  gridSize = diffSettings[currentDiff].size;

  gridEl.style.gridTemplateColumns = `repeat(${gridSize}, 1fr)`;
  gridEl.style.gridTemplateRows = `repeat(${gridSize}, 1fr)`;

  renderSequence();

  let validLevel = false;
  let attempts = 0;
  while (!validLevel) {
    generateLevel();
    validLevel = checkReachability();
    attempts++;
    if (attempts > 200) break;
  }

  renderGrid();
  renderPrintView();
}

function generateStream() {
  let placed = false;
  let attempts = 0;

  while (!placed && attempts < 50) {
    attempts++;
    let isHoriz = Math.random() < 0.5;

    let sx = Math.floor(Math.random() * gridSize);
    let sy = Math.floor(Math.random() * gridSize);

    let streamCells = [];
    let intersects = false;

    for (let i = 0; i < 3; i++) {
      let cx = sx + (isHoriz ? i : 0);
      let cy = sy + (!isHoriz ? i : 0);

      if (cx < 0 || cx >= gridSize || cy < 0 || cy >= gridSize || grid[cy][cx] !== 0) { intersects = true; break; }
      if (Math.abs(cx - rabbitPos.x) <= 1 && Math.abs(cy - rabbitPos.y) <= 1) { intersects = true; break; }
      if (Math.abs(cx - carrotPos.x) <= 1 && Math.abs(cy - carrotPos.y) <= 1) { intersects = true; break; }

      streamCells.push({ x: cx, y: cy });
    }

    if (intersects) continue;

    grid[streamCells[0].y][streamCells[0].x] = { type: 'stream', id: 30, isHoriz: isHoriz };
    grid[streamCells[1].y][streamCells[1].x] = { type: 'stream', id: 31, isHoriz: isHoriz };
    grid[streamCells[2].y][streamCells[2].x] = { type: 'stream', id: 32, isHoriz: isHoriz };

    if (checkReachability()) {
      placed = true;
    } else {
      streamCells.forEach(c => grid[c.y][c.x] = 0);
    }
  }
}

function generateLevel() {
  const theme = getTheme();
  const obstacleImages = theme.obstacles;
  grid = Array(gridSize).fill(null).map(() => Array(gridSize).fill(0));

  if (Math.random() > 0.5) {
    rabbitPos = { x: 0, y: Math.floor(Math.random() * gridSize) };
    carrotPos = { x: gridSize - 1, y: Math.floor(Math.random() * gridSize) };
  } else {
    rabbitPos = { x: Math.floor(Math.random() * gridSize), y: 0 };
    carrotPos = { x: Math.floor(Math.random() * gridSize), y: gridSize - 1 };
  }

  grid[rabbitPos.y][rabbitPos.x] = 1;
  grid[carrotPos.y][carrotPos.x] = 2;

  if (currentDiff === 'hard' || (currentDiff === 'medium' && Math.random() < 0.5)) {
    generateStream();
  }

  let placed = 0;
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (typeof grid[y][x] === 'object') placed++;
    }
  }

  let numObstacles = diffSettings[currentDiff].obstacles;

  if (currentDiff === 'medium' || currentDiff === 'hard') {
    let blockX, blockY;
    if (rabbitPos.x === carrotPos.x) {
      blockX = rabbitPos.x;
      blockY = Math.floor((rabbitPos.y + carrotPos.y) / 2);
    } else if (rabbitPos.y === carrotPos.y) {
      blockY = rabbitPos.y;
      blockX = Math.floor((rabbitPos.x + carrotPos.x) / 2);
    } else {
      blockX = Math.random() > 0.5 ? rabbitPos.x : carrotPos.x;
      blockY = blockX === rabbitPos.x ? carrotPos.y : rabbitPos.y;
    }

    if (grid[blockY][blockX] === 0) {
      grid[blockY][blockX] = { type: 'obstacle', img: obstacleImages[Math.floor(Math.random() * obstacleImages.length)] };
      placed++;
    }
  }

  while (placed < numObstacles) {
    let ox = Math.floor(Math.random() * gridSize);
    let oy = Math.floor(Math.random() * gridSize);

    if (grid[oy][ox] === 0 && (Math.abs(ox - rabbitPos.x) + Math.abs(oy - rabbitPos.y) > 1)) {
      grid[oy][ox] = { type: 'obstacle', img: obstacleImages[Math.floor(Math.random() * obstacleImages.length)] };
      placed++;
    }
  }
}

function canMoveTo(x, y, nx, ny) {
  if (nx < 0 || nx >= gridSize || ny < 0 || ny >= gridSize) return false;

  let target = grid[ny][nx];
  let current = grid[y][x];

  let currentId = (typeof current === 'object' && current.type === 'stream') ? current.id : 0;
  let targetId = (typeof target === 'object' && target.type === 'stream') ? target.id : 0;
  let targetType = (typeof target === 'object') ? target.type : null;

  // Simple Stream Bridge logic (id 31 is bridge)
  if (currentId === 31 && current.isHoriz && ny === y) return false; // Moving L/R off horizontal stream bridge
  if (currentId === 31 && !current.isHoriz && nx === x) return false; // Moving U/D off vertical stream bridge

  if (targetId === 31 && target.isHoriz && ny === y) return false; // Entering horizontal stream bridge from side
  if (targetId === 31 && !target.isHoriz && nx === x) return false; // Entering vertical stream bridge from side

  if (targetType === 'obstacle') return false;
  if (targetType === 'stream' && targetId !== 31) return false;

  return true;
}

function checkReachability() {
  let queue = [{ x: rabbitPos.x, y: rabbitPos.y, path: [] }];
  let visited = Array(gridSize).fill(null).map(() => Array(gridSize).fill(false));
  visited[rabbitPos.y][rabbitPos.x] = true;

  let dirs = [
    { dx: 0, dy: 1, dir: 'down' },
    { dx: 0, dy: -1, dir: 'up' },
    { dx: 1, dy: 0, dir: 'right' },
    { dx: -1, dy: 0, dir: 'left' }
  ];

  while (queue.length > 0) {
    let curr = queue.shift();
    if (curr.x === carrotPos.x && curr.y === carrotPos.y) {
      recommendedPath = curr.path;
      return true;
    }

    for (let d of dirs) {
      let nx = curr.x + d.dx;
      let ny = curr.y + d.dy;
      if (canMoveTo(curr.x, curr.y, nx, ny)) {
        if (!visited[ny][nx]) {
          visited[ny][nx] = true;
          queue.push({ x: nx, y: ny, path: [...curr.path, d.dir] });
        }
      }
    }
  }
  return false;
}

function renderGrid() {
  const theme = getTheme();
  gridEl.innerHTML = '';

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const cell = document.createElement('div');
      const parityClass = (x + y) % 2 === 0 ? 'cell-even' : 'cell-odd';
      cell.className = `cell ${parityClass}`;

      let val = grid[y][x];

      if (val === 2) {
        const img = document.createElement('img');
        img.src = theme.goal;
        cell.appendChild(img);
      } else if (typeof val === 'object') {
        if (val.type === 'obstacle') {
          const img = document.createElement('img');
          img.src = '/' + val.img;
          cell.appendChild(img);
        } else if (val.type === 'stream') {
          cell.classList.add('stream-cell');
          const img = document.createElement('img');
          let src = '';
          let rot = 0;
          switch (val.id) {
            case 30: src = '/stream_simple_end1.png'; rot = val.isHoriz ? 0 : 90; break;
            case 31: src = '/stream_simple_bridge.png'; rot = val.isHoriz ? 0 : 90; break;
            case 32: src = '/stream_simple_end2.png'; rot = val.isHoriz ? 0 : 90; break;
          }
          img.src = src;
          img.className = 'stream-img';
          img.style.transform = `rotate(${rot}deg)`;
          cell.appendChild(img);
        }
      }

      gridEl.appendChild(cell);
    }
  }

  const overlay = document.createElement('div');
  overlay.className = 'grid-border-overlay';
  gridEl.appendChild(overlay);

  const rabbit = document.createElement('div');
  rabbit.id = 'rabbit';
  rabbit.innerHTML = `<img src="${theme.hero.idle}" class="rabbit-img" />`;
  updateRabbitPosition(rabbit, rabbitPos.x, rabbitPos.y);
  gridEl.appendChild(rabbit);
}

function updateRabbitPosition(el, x, y) {
  const pad = 4; // 4% padding
  const contentPct = 100 - (pad * 2);
  const cellPct = contentPct / gridSize;
  const offset = cellPct * 0.1;
  el.style.width = `${cellPct * 0.8}%`;
  el.style.height = `${cellPct * 0.8}%`;
  el.style.left = `calc(${pad}% + ${x * cellPct}% + ${offset}%)`;
  el.style.top = `calc(${pad}% + ${y * cellPct}% + ${offset}%)`;
}

function renderPrintView() {
  const theme = getTheme();
  const printGrid = document.getElementById('print-grid');
  printGrid.innerHTML = gridEl.innerHTML;
  printGrid.style.gridTemplateColumns = `repeat(${gridSize}, 1fr)`;
  printGrid.style.gridTemplateRows = `repeat(${gridSize}, 1fr)`;

  const printPath = document.getElementById('print-path');
  printPath.innerHTML = '';

  const order = ['up', 'down', 'left', 'right'];
  let inventory = [];
  order.forEach(dir => {
    inventory = inventory.concat(recommendedPath.filter(d => d === dir));
  });

  inventory.forEach(dir => {
    printPath.innerHTML += `<img src="${theme.arrow}" class="dir-${dir}" />`;
  });

  const printArrows = document.getElementById('print-arrows');
  printArrows.innerHTML = '';
  const dirs = ['up', 'down', 'left', 'right'];
  for (let i = 0; i < 6; i++) {
    dirs.forEach(dir => {
      printArrows.innerHTML += `<div class="print-cutout"><img src="${theme.arrow}" class="dir-${dir}" /></div>`;
    });
  }
}

function renderSequence() {
  const theme = getTheme();
  sequenceEl.innerHTML = '';
  sequence.forEach((dir, index) => {
    const item = document.createElement('div');
    item.className = 'seq-item';
    item.innerHTML = `<img src="${theme.arrow}" class="arrow-img dir-${dir}" />`;
    item.addEventListener('click', () => {
      if (isAnimating) return;
      sequence.splice(index, 1);
      renderSequence();
    });
    sequenceEl.appendChild(item);
  });
  renderTrail();
}

function showModal(title, msg, isWin) {
  const theme = getTheme();
  modalTitle.textContent = title;
  modalTitle.style.color = isWin ? 'var(--primary-dark)' : 'var(--secondary-dark)';
  modalMsg.textContent = msg;

  const modalImg = document.getElementById('modal-img');
  if (modalImg) {
    modalImg.src = isWin ? theme.hero.eating : theme.hero.dizzy;
    modalImg.style.display = 'block';
  }

  modal.classList.remove('hidden');

  const closeBtn = document.getElementById('btn-modal-close');
  closeBtn.textContent = isWin ? 'Play Again' : 'Try Again';
  closeBtn.onclick = () => {
    modal.classList.add('hidden');
    if (isWin) {
      initGame();
    } else {
      resetCurrentLevel();
    }
  };
}

function resetCurrentLevel() {
  const theme = getTheme();
  sequence = [];
  isEating = false;
  renderSequence();
  const rabbitEl = document.getElementById('rabbit');
  updateRabbitPosition(rabbitEl, rabbitPos.x, rabbitPos.y);
  const rabbitImg = rabbitEl.querySelector('.rabbit-img');
  if (rabbitImg) {
    rabbitImg.src = theme.hero.idle;
    rabbitImg.style.transform = 'scaleX(1)';
  }
}

async function runSequence() {
  if (sequence.length === 0 || isAnimating) return;
  const theme = getTheme();
  isAnimating = true;
  renderTrail();

  const rabbitEl = document.getElementById('rabbit');
  const rabbitImg = rabbitEl.querySelector('.rabbit-img');
  let currX = rabbitPos.x;
  let currY = rabbitPos.y;

  for (let dir of sequence) {
    let nextX = currX;
    let nextY = currY;

    if (dir === 'up') nextY--;
    if (dir === 'down') nextY++;
    if (dir === 'left') {
      nextX--;
      if (rabbitImg) rabbitImg.style.transform = 'scaleX(-1)';
    }
    if (dir === 'right') {
      nextX++;
      if (rabbitImg) rabbitImg.style.transform = 'scaleX(1)';
    }

    if (canMoveTo(currX, currY, nextX, nextY)) {
      currX = nextX;
      currY = nextY;
      updateRabbitPosition(rabbitEl, currX, currY);
      await delay(400);
    } else {
      updateRabbitPosition(rabbitEl, nextX, nextY); // Animate bump
      await delay(200);
      updateRabbitPosition(rabbitEl, currX, currY); // Bounce back
      await delay(200);
      if (rabbitImg) rabbitImg.src = theme.hero.dizzy;
      showModal('Oops!', theme.failObstacleMsg, false);
      isAnimating = false;
      return;
    }

    if (currX === carrotPos.x && currY === carrotPos.y) {
      isEating = true;
      if (rabbitImg) {
        rabbitImg.src = theme.hero.eating;
        rabbitImg.style.transform = 'scaleX(1)';
      }
      showModal('YAY!', theme.winMsg, true);
      isAnimating = false;
      return;
    }
  }

  if (currX !== carrotPos.x || currY !== carrotPos.y) {
    if (rabbitImg) rabbitImg.src = theme.hero.dizzy;
    showModal('Hmm...', theme.failShortMsg, false);
  }

  isAnimating = false;
}

function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

function renderTrail() {
  document.querySelectorAll('.footprint').forEach(el => el.remove());
  if (!showTrail || isAnimating) return;

  let currX = rabbitPos.x;
  let currY = rabbitPos.y;
  let prints = [];
  let isError = false;
  let isSuccess = false;

  for (let dir of sequence) {
    let nextX = currX;
    let nextY = currY;

    if (dir === 'up') nextY--;
    if (dir === 'down') nextY++;
    if (dir === 'left') nextX--;
    if (dir === 'right') nextX++;

    let rot = 0;
    if (dir === 'up') rot = 0;
    if (dir === 'right') rot = 90;
    if (dir === 'down') rot = 180;
    if (dir === 'left') rot = 270;

    if (canMoveTo(currX, currY, nextX, nextY)) {
      currX = nextX;
      currY = nextY;
      prints.push({ x: currX, y: currY, rot: rot });

      if (currX === carrotPos.x && currY === carrotPos.y) {
        isSuccess = true;
        break;
      }
    } else {
      isError = true;
      prints.push({ x: nextX, y: nextY, rot: rot });
      break;
    }
  }

  prints.forEach(p => {
    const print = document.createElement('div');
    let extraClass = '';
    if (isError) extraClass = 'error-trail';
    else if (isSuccess) extraClass = 'success-trail';
    print.className = `footprint ${extraClass}`;
    const img = document.createElement('img');
    img.src = '/glowing_footprint_nobg.png';
    img.className = 'footprint-img';
    img.style.transform = `rotate(${p.rot}deg)`;
    print.appendChild(img);
    updateRabbitPosition(print, p.x, p.y);
    gridEl.appendChild(print);
  });
}
