// ══════════════════════════════════════════════════════════════
//  Assignment Tracker — app.js
//  Vanilla JS, no libraries
// ══════════════════════════════════════════════════════════════

// ── State ──
let countdownInterval   = null;
let autoSyncInterval    = null;
let scheduledNotifIds   = [];
let starfieldSetup      = null;  // { stop() } handle for setup screen starfield
let starfieldDash       = null;  // { stop() } handle for dashboard starfield
let isSyncing           = false;

// ── LocalStorage helpers ──
const LS = {
  get(key)        { return localStorage.getItem(key); },
  set(key, val)   { localStorage.setItem(key, val); },
  remove(key)     { localStorage.removeItem(key); },
  getJSON(key)    { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } },
  setJSON(key, v) { localStorage.setItem(key, JSON.stringify(v)); },
};

const KEYS = {
  URL:          'at_canvas_url',
  TOKEN:        'at_canvas_token',
  CUSTOM:       'at_custom',
  LAST_SYNCED:  'at_last_synced',
  CANVAS_DATA:  'at_canvas_assignments',
};

// ── Starfield ──
function initStarfield(canvasEl) {
  const ctx = canvasEl.getContext('2d');
  let width, height;
  let animId = null;
  let shootingStarTimer = null;

  // Star array
  const NUM_STARS = 160;
  const stars = [];

  function resize() {
    width  = canvasEl.offsetWidth  || canvasEl.parentElement?.offsetWidth  || 460;
    height = canvasEl.offsetHeight || canvasEl.parentElement?.offsetHeight || 760;
    canvasEl.width  = width;
    canvasEl.height = height;
    // Reposition stars within new bounds
    stars.forEach(s => {
      if (s.x > width)  s.x = Math.random() * width;
      if (s.y > height) s.y = Math.random() * height;
    });
  }

  function makeStar() {
    const r       = 0.3 + Math.random() * 1.3;           // 0.3–1.6
    const bright  = r > 1.2 && Math.random() < 0.08;     // ~8% bright
    const purple  = Math.random() < 0.22;                 // ~22% purple tint
    return {
      x:     Math.random() * width,
      y:     Math.random() * height,
      r,
      bright,
      purple,
      speed:  0.25 + Math.random() * 0.9,     // twinkle speed 0.25–1.15
      phase:  Math.random() * Math.PI * 2,
      baseOp: 0.35 + Math.random() * 0.55,    // base opacity
      amp:    0.2  + Math.random() * 0.35,    // twinkle amplitude
      vx:    (Math.random() - 0.5) * 0.09,   // drift ±0.045
      vy:    (Math.random() - 0.5) * 0.09,
    };
  }

  // Active shooting stars
  const shootingStars = [];

  function spawnShootingStar() {
    const angle   = -Math.PI / 6 + (Math.random() - 0.5) * 0.4; // ~-30deg
    const speed   = 6 + Math.random() * 8;
    shootingStars.push({
      x:      Math.random() * width * 1.2 - width * 0.1,
      y:      Math.random() * height * 0.4,
      vx:     Math.cos(angle) * speed,
      vy:     Math.sin(angle) * speed + speed * 0.3,
      len:    60 + Math.random() * 80,
      alpha:  1,
      life:   1,
    });
    scheduleNextShootingStar();
  }

  function scheduleNextShootingStar() {
    const delay = (3500 + Math.random() * 8000); // 3.5–11.5s
    shootingStarTimer = setTimeout(spawnShootingStar, delay);
  }

  let lastTime = 0;

  function draw(ts) {
    animId = requestAnimationFrame(draw);
    const dt = Math.min((ts - lastTime) / 1000, 0.1); // seconds, cap at 0.1
    lastTime = ts;

    ctx.clearRect(0, 0, width, height);

    // Draw regular stars
    stars.forEach(s => {
      // Update twinkle
      s.phase += s.speed * dt;
      const opacity = s.baseOp + Math.sin(s.phase) * s.amp;
      const alpha   = Math.max(0.05, Math.min(1, opacity));

      // Drift
      s.x += s.vx;
      s.y += s.vy;
      // Wrap
      if (s.x < 0)      s.x += width;
      if (s.x > width)  s.x -= width;
      if (s.y < 0)      s.y += height;
      if (s.y > height) s.y -= height;

      const haloR = s.bright || s.purple ? s.r * 5 : s.r * 3;
      const coreColor = s.purple
        ? `rgba(192,132,252,${alpha})`
        : `rgba(255,255,255,${alpha})`;

      // Radial gradient halo
      const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, haloR);
      if (s.purple) {
        grad.addColorStop(0, `rgba(192,132,252,${alpha * 0.6})`);
        grad.addColorStop(1, 'rgba(168,85,247,0)');
      } else {
        grad.addColorStop(0, `rgba(255,255,255,${alpha * 0.4})`);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
      }

      ctx.beginPath();
      ctx.arc(s.x, s.y, haloR, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // Solid core
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = coreColor;
      ctx.fill();

      // Cross-sparkle for bright stars
      if (s.bright && alpha > 0.55) {
        const len = s.r * 4;
        ctx.save();
        ctx.globalAlpha = alpha * 0.5;
        ctx.strokeStyle = s.purple ? 'rgba(192,132,252,0.9)' : 'rgba(255,255,255,0.9)';
        ctx.lineWidth   = 0.5;
        ctx.beginPath();
        ctx.moveTo(s.x - len, s.y); ctx.lineTo(s.x + len, s.y);
        ctx.moveTo(s.x, s.y - len); ctx.lineTo(s.x, s.y + len);
        ctx.stroke();
        ctx.restore();
      }
    });

    // Draw shooting stars
    for (let i = shootingStars.length - 1; i >= 0; i--) {
      const ss = shootingStars[i];
      ss.x    += ss.vx;
      ss.y    += ss.vy;
      ss.life -= dt * 1.2;
      ss.alpha = Math.max(0, ss.life);

      if (ss.alpha <= 0 || ss.x < -200 || ss.y > height + 200) {
        shootingStars.splice(i, 1);
        continue;
      }

      // Trail gradient: purple at tail → white at head
      const tailX = ss.x - ss.vx / (Math.abs(ss.vx) || 1) * ss.len;
      const tailY = ss.y - ss.vy / (Math.abs(ss.vy) || 1) * ss.len;
      const trailGrad = ctx.createLinearGradient(tailX, tailY, ss.x, ss.y);
      trailGrad.addColorStop(0, `rgba(168,85,247,0)`);
      trailGrad.addColorStop(0.5, `rgba(192,132,252,${ss.alpha * 0.4})`);
      trailGrad.addColorStop(1, `rgba(255,255,255,${ss.alpha})`);

      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(ss.x, ss.y);
      ctx.strokeStyle = trailGrad;
      ctx.lineWidth   = 1.5;
      ctx.stroke();

      // Glowing head
      const headGrad = ctx.createRadialGradient(ss.x, ss.y, 0, ss.x, ss.y, 6);
      headGrad.addColorStop(0, `rgba(255,255,255,${ss.alpha})`);
      headGrad.addColorStop(0.4, `rgba(192,132,252,${ss.alpha * 0.6})`);
      headGrad.addColorStop(1, 'rgba(168,85,247,0)');
      ctx.beginPath();
      ctx.arc(ss.x, ss.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = headGrad;
      ctx.fill();
    }
  }

  // Init
  resize();
  for (let i = 0; i < NUM_STARS; i++) stars.push(makeStar());

  // Handle resize
  const resizeObserver = new ResizeObserver(() => resize());
  resizeObserver.observe(canvasEl.parentElement || canvasEl);

  animId = requestAnimationFrame(draw);
  scheduleNextShootingStar();

  return {
    stop() {
      if (animId)           cancelAnimationFrame(animId);
      if (shootingStarTimer) clearTimeout(shootingStarTimer);
      resizeObserver.disconnect();
      animId = null;
    }
  };
}

// ── API ──
// All Canvas calls go through the Cloudflare proxy to handle CORS.
const PROXY_URL = 'https://canvas-proxy.jcfurce.workers.dev';

async function apiFetch(url, token) {
  const canvasBase = LS.get(KEYS.URL) || '';
  const proxied = canvasBase ? url.replace(canvasBase, PROXY_URL) : url;
  const res = await fetch(proxied, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

async function testConnection(canvasUrl, token) {
  const res = await fetch(`${PROXY_URL}/api/v1/users/self`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return true;
}

// ── Render ──
function getMergedAssignments() {
  const canvas = LS.getJSON(KEYS.CANVAS_DATA) || [];
  const custom = LS.getJSON(KEYS.CUSTOM) || [];
  return [...canvas, ...custom].sort(
    (a, b) => new Date(a.dueDate) - new Date(b.dueDate)
  );
}

function buildCard(assignment, isOverdue) {
  const card   = document.createElement('div');
  const now    = new Date();
  const due    = new Date(assignment.dueDate);
  const diffMs = due - now;
  const diffD  = diffMs / 86400000;

  // Urgency class + strip color
  let ugClass   = '';
  let stripClass = '';

  if (isOverdue) {
    ugClass    = 'overdue';
    stripClass = 'grey';
  } else if (diffD < 3) {
    ugClass    = 'ug-red';
    stripClass = 'red';
  } else if (diffD < 7) {
    ugClass    = 'ug-orange';
    stripClass = 'orange';
  } else {
    ugClass    = 'ug-green';
    stripClass = 'green';
  }

  card.className   = `card ${ugClass}`;
  card.dataset.id  = assignment.id;
  if (assignment.url) card.dataset.url = assignment.url;

  // SVG icons
  const canvasSVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
  </svg>`;

  const customSVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>`;

  const srcClass = assignment.type === 'canvas' ? 'canvas' : 'custom';
  const srcSVG   = assignment.type === 'canvas' ? canvasSVG : customSVG;

  const initialCountdown = formatCountdown(diffMs);

  card.innerHTML = `
    <div class="strip ${stripClass}"></div>
    <div class="card-body">
      <div class="card-name">${escapeHTML(assignment.name)}</div>
      <div class="card-course">${escapeHTML(assignment.course || '')}</div>
    </div>
    <div class="card-right">
      <span class="countdown${isOverdue ? ' od' : (diffD < 3 ? ' urgent' : '')}" data-due="${escapeHTML(assignment.dueDate)}">${initialCountdown}</span>
      <span class="src ${srcClass}">${srcSVG}</span>
    </div>`;

  // Click to open Canvas URL
  if (assignment.url) {
    card.addEventListener('click', () => {
      if (assignment.url && assignment.url.startsWith('https://')) {
        window.open(assignment.url, '_blank', 'noopener,noreferrer');
      }
    });
  }

  return card;
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderSection(cardsId, countId, assignments, isOverdue) {
  const container = document.getElementById(cardsId);
  const countEl   = document.getElementById(countId);
  countEl.textContent = assignments.length;
  container.innerHTML = '';

  assignments.forEach(a => {
    const card = buildCard(a, isOverdue);
    container.appendChild(card);
  });
}

function renderDashboard() {
  const all = getMergedAssignments();
  const now = new Date();

  const overdue  = all.filter(a => new Date(a.dueDate) < now);
  const upcoming = all.filter(a => new Date(a.dueDate) >= now);

  renderSection('overdue-cards',  'overdue-count',  overdue,  true);
  renderSection('upcoming-cards', 'upcoming-count', upcoming, false);

  // Show/hide overdue section
  document.getElementById('overdue-section').style.display =
    overdue.length ? '' : 'none';
}

// ── Countdown ──
function formatCountdown(diffMs) {
  if (diffMs < 0) {
    const abs = Math.abs(diffMs);
    const d   = Math.floor(abs / 86400000);
    return d > 0 ? `${d}d ago` : 'Overdue';
  }
  const d = Math.floor(diffMs / 86400000);
  const h = Math.floor((diffMs % 86400000) / 3600000);
  const m = Math.floor((diffMs % 3600000) / 60000);
  const s = Math.floor((diffMs % 60000) / 1000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

function updateCountdowns() {
  const now = new Date();
  document.querySelectorAll('.countdown[data-due]').forEach(el => {
    const due  = new Date(el.dataset.due);
    const diff = due - now;
    el.textContent = formatCountdown(diff);

    // Flash glow on tick
    el.classList.add('tick');
    setTimeout(() => el.classList.remove('tick'), 120);
  });
}

function startCountdownTimer() {
  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(updateCountdowns, 1000);
}

// ── Modals ──
function openModal(modalId, focusId) {
  document.getElementById(modalId).classList.add('active');
  if (focusId) {
    const el = document.getElementById(focusId);
    if (el) setTimeout(() => el.focus(), 50);
  }
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
}

function setupAddModal() {
  const addBtn     = document.getElementById('add-btn');
  const modal      = document.getElementById('add-modal');
  const closeBtn   = document.getElementById('modal-close');
  const form       = document.getElementById('add-form');

  addBtn.addEventListener('click', () => {
    openModal('add-modal', 'add-name');
  });

  closeBtn.addEventListener('click', () => closeModal('add-modal'));

  // Close on overlay click
  modal.addEventListener('click', e => {
    if (e.target === modal || e.target.classList.contains('modal-overlay')) {
      closeModal('add-modal');
    }
  });

  form.addEventListener('submit', e => {
    e.preventDefault();

    const name   = document.getElementById('add-name').value.trim();
    const course = document.getElementById('add-course').value.trim();
    const due    = document.getElementById('add-due').value;

    // Validate
    if (!name) {
      showFormError(form, 'Assignment name is required.');
      return;
    }
    if (!due) {
      showFormError(form, 'Due date is required.');
      return;
    }
    const dueDate = new Date(due);
    if (dueDate <= new Date()) {
      showFormError(form, 'Due date must be in the future.');
      return;
    }

    clearFormError(form);

    const assignment = {
      id:      'custom_' + Date.now(),
      name,
      course,
      dueDate: dueDate.toISOString(),
      url:     null,
      type:    'custom',
    };

    const existing = LS.getJSON(KEYS.CUSTOM) || [];
    existing.push(assignment);
    LS.setJSON(KEYS.CUSTOM, existing);

    closeModal('add-modal');
    form.reset();
    renderDashboard();
    scheduleNotifications(getMergedAssignments());
  });
}

function showFormError(form, msg) {
  clearFormError(form);
  const err = document.createElement('p');
  err.className   = 'f-hint form-error';
  err.style.color = '#EF4444';
  err.style.marginTop = '8px';
  err.textContent = msg;
  form.appendChild(err);
}

function clearFormError(form) {
  const existing = form.querySelector('.form-error');
  if (existing) existing.remove();
}

// ── Settings ──
function setupSettingsModal() {
  const settingsBtn  = document.getElementById('settings-btn');
  const modal        = document.getElementById('settings-modal');
  const closeBtn     = document.getElementById('settings-close');
  const saveBtn      = document.getElementById('settings-save');
  const clearBtn     = document.getElementById('settings-clear');
  const form         = document.getElementById('settings-form');

  settingsBtn.addEventListener('click', () => {
    // Populate with current values
    document.getElementById('settings-url').value   = LS.get(KEYS.URL)   || '';
    document.getElementById('settings-token').value = LS.get(KEYS.TOKEN) || '';
    openModal('settings-modal');
  });

  closeBtn.addEventListener('click', () => closeModal('settings-modal'));

  modal.addEventListener('click', e => {
    if (e.target === modal || e.target.classList.contains('modal-overlay')) {
      closeModal('settings-modal');
    }
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const newUrl   = document.getElementById('settings-url').value.trim();
    const newToken = document.getElementById('settings-token').value.trim();

    if (!newUrl || !newToken) {
      showFormError(form, 'Both Canvas URL and API token are required.');
      return;
    }

    clearFormError(form);
    LS.set(KEYS.URL,   newUrl);
    LS.set(KEYS.TOKEN, newToken);

    closeModal('settings-modal');
    syncCanvas();
  });

  document.getElementById('settings-phone-link').addEventListener('click', () => {
    const url   = LS.get(KEYS.URL)   || '';
    const token = LS.get(KEYS.TOKEN) || '';
    if (!url || !token) {
      alert('No Canvas credentials saved yet.');
      return;
    }
    const payload = btoa(JSON.stringify({ url, token }));
    const link = `${location.origin}${location.pathname}#setup=${payload}`;
    navigator.clipboard.writeText(link).then(() => {
      const btn = document.getElementById('settings-phone-link');
      const orig = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = orig; }, 2000);
    }).catch(() => {
      prompt('Copy this link and send it to your phone:', link);
    });
  });

  clearBtn.addEventListener('click', () => {
    if (confirm('Delete all data and reset the app?')) {
      Object.values(KEYS).forEach(k => LS.remove(k));
      location.reload();
    }
  });
}

// ── Sync ──
function setSyncing(active) {
  const btns = [
    document.getElementById('sync-btn'),
    document.getElementById('footer-sync-btn'),
  ];
  btns.forEach(btn => {
    if (!btn) return;
    if (active) {
      btn.classList.add('syncing');
      btn.disabled = true;
      // Inline rotate animation on the SVG
      const svg = btn.querySelector('svg');
      if (svg) svg.style.animation = 'spin 1s linear infinite';
    } else {
      btn.classList.remove('syncing');
      btn.disabled = false;
      const svg = btn.querySelector('svg');
      if (svg) svg.style.animation = '';
    }
  });
}

async function syncCanvas() {
  if (isSyncing) return;
  isSyncing = true;

  const url   = (LS.get(KEYS.URL) || '').replace(/\/+$/, '');
  const token = LS.get(KEYS.TOKEN);
  if (!url || !token) { isSyncing = false; return; }

  setSyncing(true);

  try {
    // Fetch all active courses
    const courses = await apiFetch(
      `${url}/api/v1/courses?enrollment_state=active&per_page=50`,
      token
    );
    if (!Array.isArray(courses)) throw new Error('Unexpected API response for courses');

    // For each course, fetch upcoming assignments
    const assignments = [];
    for (const course of courses) {
      let items;
      try {
        items = await apiFetch(
          `${url}/api/v1/courses/${course.id}/assignments?bucket=upcoming&per_page=50&include[]=submission`,
          token
        );
      } catch {
        // Skip courses that fail (e.g., concluded with no assignments endpoint)
        continue;
      }
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        if (!item.due_at) continue;
        assignments.push({
          id:      `canvas_${item.id}`,
          name:    item.name,
          course:  course.name,
          dueDate: item.due_at,
          url:     item.html_url,
          type:    'canvas',
        });
      }
    }

    LS.setJSON(KEYS.CANVAS_DATA, assignments);
    LS.set(KEYS.LAST_SYNCED, new Date().toISOString());
    renderDashboard();
    updateLastSynced();
    scheduleNotifications(getMergedAssignments());
  } catch (err) {
    console.error('Canvas sync failed:', err);
  } finally {
    setSyncing(false);
    isSyncing = false;
  }
}

function setupSyncButtons() {
  document.getElementById('sync-btn').addEventListener('click', syncCanvas);
  document.getElementById('footer-sync-btn').addEventListener('click', syncCanvas);
}

// ── Last Synced Footer ──
function updateLastSynced() {
  const ts = LS.get(KEYS.LAST_SYNCED);
  const el = document.getElementById('last-synced');
  if (!ts) { el.textContent = 'Last synced: never'; return; }
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)        el.textContent = 'Last synced: just now';
  else if (mins < 60)  el.textContent = `Last synced: ${mins} min ago`;
  else                 el.textContent = `Last synced: ${Math.floor(mins / 60)}h ago`;
}

// ── Notifications ──
const MAX_TIMEOUT = 2147483647;

async function requestNotificationPermission() {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}

function showNotification(title, body) {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/icon.png' });
  }
}

function scheduleNotifications(assignments) {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;

  // Clear previously scheduled timeouts
  scheduledNotifIds.forEach(id => clearTimeout(id));
  scheduledNotifIds = [];

  const now = Date.now();
  assignments.forEach(a => {
    const due = new Date(a.dueDate).getTime();
    if (due <= now) return;

    // 1 day before
    const oneDayBefore = due - 86400000;
    const delayOneDayBefore = oneDayBefore - now;
    if (delayOneDayBefore > 0 && delayOneDayBefore < MAX_TIMEOUT) {
      const id = setTimeout(() => {
        showNotification(`Due tomorrow: ${a.name}`, a.course);
      }, delayOneDayBefore);
      scheduledNotifIds.push(id);
    }

    // Morning of due date (7am)
    const dueDate   = new Date(a.dueDate);
    const morningOf = new Date(
      dueDate.getFullYear(),
      dueDate.getMonth(),
      dueDate.getDate(),
      7, 0, 0
    ).getTime();
    const delayMorningOf = morningOf - now;
    if (delayMorningOf > 0 && delayMorningOf < MAX_TIMEOUT) {
      const id = setTimeout(() => {
        showNotification(`Due today: ${a.name}`, a.course);
      }, delayMorningOf);
      scheduledNotifIds.push(id);
    }
  });
}

// ── Dashboard Init ──
function initDashboard() {
  // 1. Starfield on dashboard canvas
  const dashCanvas = document.getElementById('dash-star-canvas');
  if (starfieldDash) starfieldDash.stop();
  starfieldDash = initStarfield(dashCanvas);

  // 2–4. Load data and render
  renderDashboard();

  // 5. Live countdown timer
  startCountdownTimer();

  // 6. Sync from Canvas (non-blocking)
  syncCanvas();

  // 7. Auto-sync every 30 minutes
  if (autoSyncInterval) clearInterval(autoSyncInterval);
  autoSyncInterval = setInterval(syncCanvas, 30 * 60 * 1000);

  // 8. Update footer last-synced text (and keep it fresh every 60s)
  updateLastSynced();
  setInterval(() => updateLastSynced(), 60000);

  // 9. Request notification permission once
  requestNotificationPermission();

  // 10. Schedule notifications
  scheduleNotifications(getMergedAssignments());
}

// ── Setup Screen ──
function initSetup() {
  const form      = document.getElementById('setup-form');
  const urlInput  = document.getElementById('canvas-url');
  const tokenInput = document.getElementById('canvas-token');
  const connectBtn = document.getElementById('connect-btn');

  // Error element (injected dynamically)
  let errEl = null;

  function showSetupError(msg) {
    if (!errEl) {
      errEl = document.createElement('p');
      errEl.className   = 'f-hint';
      errEl.style.color = '#EF4444';
      errEl.style.marginTop = '10px';
      connectBtn.insertAdjacentElement('afterend', errEl);
    }
    errEl.textContent = msg;
  }

  function clearSetupError() {
    if (errEl) { errEl.textContent = ''; }
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    clearSetupError();

    let canvasUrl = urlInput.value.trim();
    const token     = tokenInput.value.trim();

    // Validate non-empty + looks like a URL
    if (!canvasUrl || !token) {
      showSetupError('Both fields are required.');
      return;
    }
    if (!/^https:\/\/.+/.test(canvasUrl)) {
      showSetupError('Canvas URL must start with https://');
      return;
    }

    // Normalize trailing slash before any use
    canvasUrl = canvasUrl.replace(/\/+$/, '');

    // Disable button while connecting
    connectBtn.disabled = true;
    connectBtn.textContent = 'Connecting\u2026';

    try {
      await testConnection(canvasUrl, token);
    } catch {
      showSetupError('Could not connect. Check your URL and token.');
      connectBtn.disabled = false;
      connectBtn.textContent = 'CONNECT TO CANVAS';
      return;
    }

    // Save to localStorage
    LS.set(KEYS.URL,   canvasUrl);
    LS.set(KEYS.TOKEN, token);

    // Request notification permission right after successful connect
    await requestNotificationPermission();

    // Transition to dashboard
    document.getElementById('setup-screen').classList.remove('active');
    document.getElementById('dashboard-screen').classList.add('active');

    // Stop setup starfield to free resources
    if (starfieldSetup) {
      starfieldSetup.stop();
      starfieldSetup = null;
    }

    initDashboard();
  });
}

// ── Init (entry point) ──
function init() {
  // Handle phone setup link: #setup=base64encodedJSON
  const hash = location.hash;
  if (hash.startsWith('#setup=')) {
    try {
      const { url, token } = JSON.parse(atob(hash.slice(7)));
      if (url && token) {
        LS.set(KEYS.URL,   url.replace(/\/+$/, ''));
        LS.set(KEYS.TOKEN, token);
        history.replaceState(null, '', location.pathname);
      }
    } catch { /* malformed hash — ignore */ }
  }

  const hasToken = LS.get(KEYS.TOKEN);

  if (!hasToken) {
    // Show setup screen
    document.getElementById('setup-screen').classList.add('active');

    // Starfield on setup canvas
    const setupCanvas = document.getElementById('star-canvas');
    starfieldSetup = initStarfield(setupCanvas);

    // Wire up the setup form
    initSetup();
  } else {
    // Show dashboard
    document.getElementById('dashboard-screen').classList.add('active');
    initDashboard();
  }

  // Wire up modals and sync buttons (always — they live in dashboard)
  setupAddModal();
  setupSettingsModal();
  setupSyncButtons();
}

// Add CSS for spin animation dynamically (used by setSyncing)
(function injectSpinKeyframe() {
  if (document.getElementById('at-spin-style')) return;
  const style = document.createElement('style');
  style.id = 'at-spin-style';
  style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(style);
})();

// Kick off on DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
