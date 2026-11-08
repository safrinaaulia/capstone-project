/**
 * SIKLUSAYAM — Smart Poultry Learning & Management Platform
 * script.js  |  Vanilla JS ES6+  |  AI Builders Challenge 2026
 *
 * All data in this application is DEMONSTRATION / SIMULATED data.
 * It does not represent real farm measurements.
 */

'use strict';

/* ═══════════════════════════════════════════════════════════════════
   CONSTANTS & CONFIGURATION
═══════════════════════════════════════════════════════════════════ */

/** Page title map (data-page → human readable) */
const PAGE_TITLES = {
  dashboard:    'Dashboard',
  lifecycle:    'Chicken Lifecycle',
  eggformation: 'Egg Formation Explorer',
  simulation:   'Poultry Simulation',
  ai:           'Smart Poultry AI',
  production:   'Egg Production Monitoring',
  health:       'Chicken Health',
  learning:     'Learning Resources',
};

/** Visual icons per lifecycle phase */
const FASE_ICONS = {
  'DOC':       '🐣',
  'Starter':   '🐤',
  'Grower':    '🐔',
  'Pre-Layer': '🐓',
  'Layer':     '🥚',
};

/** Extra detail content per lifecycle phase */
const FASE_EXTRA = {
  'DOC': {
    tag: 'Critical Period',
    detail: 'Day-Old Chicks require consistent brooder temperature (34–35 °C), round-the-clock observation, and clean water with added vitamins to overcome transport stress.',
  },
  'Starter': {
    tag: 'Growth Boost',
    detail: 'Rapid feather and skeletal development. High-protein starter feed (18–20% CP) supports muscle growth. Ensure even feeder and waterer access.',
  },
  'Grower': {
    tag: 'Body Development',
    detail: 'Gradual shift from high-protein to grower feed (15–16% CP). Monitor body weight weekly against breed standard to avoid over- or under-conditioning.',
  },
  'Pre-Layer': {
    tag: 'Pre-Production',
    detail: 'Transition to pre-layer feed rich in calcium (2%) to prepare the reproductive tract. Introduce nest boxes and reduce disturbances.',
  },
  'Layer': {
    tag: 'Peak Production',
    detail: 'Maintain layer feed (16–17% CP, 3.5–4% Ca) and consistent 16-hour light programme. Track Hen Day Production (HDP) daily to detect drops early.',
  },
};

/** SVG layer IDs targeted by each egg-formation step (index = step number) */
const EGG_SVG_TARGETS = [
  ['svgYolk'],                          // Step 1 – Yolk Formation
  ['svgGerm'],                          // Step 2 – Ovulation
  ['svgInfundibulum'],      // Step 3 – Infundibulum
  ['svgAlbumen', 'svgChalaza'],         // Step 4 – Albumen and Chalaza
  ['svgInnerMem', 'svgOuterMem'],       // Step 5 – Shell Membranes
  ['svgShell'],                         // Step 6 – Shell Calcification
  ['svgShell', 'svgPigment'],           // Step 7 – Pigmentation and Cuticle
  ['svgAir'],                           // Step 8 – Laying
];

/** LocalStorage / SessionStorage keys */
const STORAGE_KEY = 'siklusayam_v3_logs';

/** Global module state */
const State = {
  faseData:   [],   // data_fase_ayam.csv rows
  pakanData:  [],   // data_pakan.csv rows
  ayamData:   [],   // data_ayam.csv rows
  prodData:   [],   // data_produksi.csv rows (CSV seed)
  kesehatanData:  [],
  pengetahuanData: [],
  prodLogs:   [],   // all production records (CSV seed + user entries)
  dashChart:  null, // Chart instance
  prodChart:  null, // Chart instance
};

/* ═══════════════════════════════════════════════════════════════════
   DOM HELPERS
═══════════════════════════════════════════════════════════════════ */

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

/**
 * Create an HTML element with optional attributes and children.
 * @param {string} tag
 * @param {Object} [attrs]
 * @param {...(Node|string)} [children]
 * @returns {HTMLElement}
 */
function mk(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'cls') {
      if (Array.isArray(v)) v.forEach(c => el.classList.add(c));
      else el.className = v;
    } else if (k.startsWith('on')) {
      el.addEventListener(k.slice(2), v);
    } else {
      el.setAttribute(k, v);
    }
  }
  for (const child of children) {
    if (child == null) continue;
    if (typeof child === 'string' || typeof child === 'number') {
      el.append(document.createTextNode(String(child)));
    } else {
      el.append(child);
    }
  }
  return el;
}

/* ═══════════════════════════════════════════════════════════════════
   CSV UTILITIES
═══════════════════════════════════════════════════════════════════ */

/**
 * Split a single CSV line respecting double-quoted fields that may
 * contain commas.
 * @param {string} line
 * @returns {string[]}
 */
function splitLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

/**
 * Parse a CSV string (with optional BOM) into an array of objects.
 * @param {string} text
 * @returns {Object[]}
 */
function parseCSV(text) {
  const clean = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = clean.split('\n').filter(l => l.trim() !== '');
  if (lines.length < 2) return [];
  const headers = splitLine(lines[0]);
  return lines.slice(1).map(line => {
    const vals = splitLine(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] !== undefined ? vals[i] : ''; });
    return obj;
  });
}

/**
 * Fetch and parse a CSV file.
 * @param {string} path
 * @returns {Promise<Object[]>}
 */
async function loadCSV(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Cannot load ${path} (HTTP ${res.status})`);
  const text = await res.text();
  return parseCSV(text);
}

/**
 * Display an error message in a designated error element.
 * @param {string} elId
 * @param {string} msg
 */
function showCSVError(elId, msg) {
  const el = $(elId);
  if (!el) return;
  el.textContent = `Data load error: ${msg}`;
  el.style.display = 'block';
}

/* ═══════════════════════════════════════════════════════════════════
   SIDEBAR & NAVIGATION
═══════════════════════════════════════════════════════════════════ */

function initSidebar() {
  const sidebar = $('#sidebar');
  const overlay = $('#sidebarOverlay');
  const menuBtn = $('#menuBtn');

  if (!sidebar || !overlay || !menuBtn) return;

  function openSidebar() {
    sidebar.classList.add('open');
    overlay.classList.add('visible');
    overlay.removeAttribute('aria-hidden');
    menuBtn.setAttribute('aria-expanded', 'true');
  }

  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('visible');
    overlay.setAttribute('aria-hidden', 'true');
    menuBtn.setAttribute('aria-expanded', 'false');
  }

  menuBtn.addEventListener('click', () => {
    if (window.innerWidth <= 768) {
      // Mobile: buka atau tutup sidebar
      if (sidebar.classList.contains('open')) {
        closeSidebar();
      } else {
        openSidebar();
      }
    } else {
      // Laptop/Desktop: sembunyikan atau tampilkan sidebar
      const isCollapsed = document.body.classList.toggle(
        'sidebar-collapsed'
      );

      menuBtn.setAttribute(
        'aria-expanded',
        String(!isCollapsed)
      );
    }
  });

  // Klik area luar sidebar untuk menutupnya di mobile
  overlay.addEventListener('click', closeSidebar);

  // Reset kondisi sidebar ketika ukuran layar berubah
  window.addEventListener('resize', () => {
    closeSidebar();
    document.body.classList.remove('sidebar-collapsed');
  });
}

/**
 * Navigate to a page by its data-page key.
 * @param {string} page
 */
function navigateTo(page) {
  if (!PAGE_TITLES[page]) return;

  // Update active class on pages
  $$('.page').forEach(p => p.classList.remove('active'));
  const target = $(`#page-${page}`);
  if (target) {
    target.classList.add('active');
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }

  // Update nav links
  $$('.nav-link').forEach(link => {
    const isActive = link.dataset.page === page;
    link.classList.toggle('active', isActive);
    if (isActive) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });

  // Update heading
  const heading = $('#pageHeading');
  if (heading) heading.textContent = PAGE_TITLES[page];

  // Close sidebar on mobile after navigation
  if (window.innerWidth < 992) {
    $('#sidebar').classList.remove('open');
    $('#sidebarOverlay').classList.remove('visible');
    $('#sidebarOverlay').setAttribute('aria-hidden', 'true');
    $('#menuBtn').setAttribute('aria-expanded', 'false');
  }

  // Lazy-render page charts when navigated to
  if (page === 'dashboard' && State.prodData.length) renderDashChart();
  if (page === 'production') renderProdChart();
}

function initNavigation() {
  // Sidebar nav links
  $$('.nav-link[data-page]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(link.dataset.page);
    });
  });

  // Quick-nav buttons on dashboard
  $$('.quick-btn[data-page]').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.page));
  });
}

/* ═══════════════════════════════════════════════════════════════════
   GLOBAL SEARCH
═══════════════════════════════════════════════════════════════════ */

const SEARCH_INDEX = [
  { label: 'Dashboard – Overview',           page: 'dashboard'    },
  { label: 'Chicken Lifecycle – DOC to Layer',page: 'lifecycle'   },
  { label: 'Egg Formation – Biology steps',   page: 'eggformation'},
  { label: 'Poultry Simulation – Feed calc',  page: 'simulation'  },
  { label: 'Smart Poultry AI – Assistant',    page: 'ai'          },
  { label: 'Egg Production – Daily log',      page: 'production'  },
  { label: 'Chicken Health – Symptoms',       page: 'health'      },
  { label: 'Learning Resources – FAQ',        page: 'learning'    },
];

function initSearch() {
  const input    = $('#globalSearch');
  const dropdown = $('#searchDropdown');

  function renderDropdown(results) {
    dropdown.innerHTML = '';
    if (!results.length) {
      dropdown.style.display = 'none';
      return;
    }
    results.forEach(item => {
      const li = mk('li', { role: 'option', tabindex: '0', cls: 'search-result-item' }, item.label);
      li.addEventListener('click', () => {
        navigateTo(item.page);
        input.value = '';
        dropdown.style.display = 'none';
      });
      li.addEventListener('keydown', e => {
        if (e.key === 'Enter') li.click();
      });
      dropdown.appendChild(li);
    });
    dropdown.style.display = 'block';
  }

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { dropdown.style.display = 'none'; return; }
    const results = SEARCH_INDEX.filter(i => i.label.toLowerCase().includes(q));
    renderDropdown(results);
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.search-wrap')) dropdown.style.display = 'none';
  });
}

/* ═══════════════════════════════════════════════════════════════════
   NOTIFICATION BUTTON
═══════════════════════════════════════════════════════════════════ */

function initNotifications() {
  const btn   = $('#notifBtn');
  const badge = $('#notifBadge');
  if (!btn) return;
  btn.addEventListener('click', () => {
    badge.style.display = 'none';
    btn.setAttribute('aria-label', 'Notifications (no new)');
    alert('📢 Notification: Demonstration data loaded successfully.\nThis platform is running in educational demonstration mode.');
  });
}

/* ═══════════════════════════════════════════════════════════════════
   CANVAS CHART HELPER  (lightweight — no external library)
═══════════════════════════════════════════════════════════════════ */

/**
 * Draw a simple line chart on a <canvas> element.
 * @param {HTMLCanvasElement} canvas
 * @param {string[]} labels
 * @param {number[]} values
 * @param {Object} opts
 */

function drawLineChart(canvas, labels, values, opts = {}) {
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const W = canvas.offsetWidth || 600;
  const H = canvas.offsetHeight || 220;

  canvas.width = W;
  canvas.height = H;

  ctx.clearRect(0, 0, W, H);

  // Keep only valid numeric values and matching labels
  const validData = values
    .map((value, index) => ({
      value: Number(value),
      label: labels[index] ?? ''
    }))
    .filter(item => Number.isFinite(item.value));

  if (!validData.length) return;

  const validValues = validData.map(item => item.value);
  const validLabels = validData.map(item => item.label);

  const PAD = { top: 24, right: 24, bottom: 40, left: 48 };

  const cW = Math.max(1, W - PAD.left - PAD.right);
  const cH = Math.max(1, H - PAD.top - PAD.bottom);

  const min = opts.min !== undefined
    ? opts.min
    : Math.max(0, Math.min(...validValues) - 5);

  const max = opts.max !== undefined
    ? opts.max
    : Math.max(...validValues) + 5;

  const range = max - min || 1;

  // Convert values into canvas coordinates
  const getX = i =>
    PAD.left + (i / Math.max(validValues.length - 1, 1)) * cW;

  const getY = value =>
    PAD.top + cH - ((value - min) / range) * cH;

  // Grid lines
  const gridCount = 5;

  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1;
  ctx.font = '11px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = '#57606a';

  for (let i = 0; i <= gridCount; i++) {
    const y = PAD.top + cH - (i / gridCount) * cH;

    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(PAD.left + cW, y);
    ctx.stroke();

    const val = (min + (i / gridCount) * range).toFixed(1);

    ctx.textAlign = 'right';
    ctx.fillText(
      val + (opts.unit || ''),
      PAD.left - 4,
      y + 4
    );
  }

  // X-axis labels
  ctx.fillStyle = '#57606a';
  ctx.textAlign = 'center';

  validLabels.forEach((label, i) => {
    ctx.fillText(label, getX(i), H - PAD.bottom + 16);
  });

  // Fill area
  if (validValues.length >= 2) {
    ctx.beginPath();

    validValues.forEach((value, i) => {
      const x = getX(i);
      const y = getY(value);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.lineTo(getX(validValues.length - 1), PAD.top + cH);
    ctx.lineTo(getX(0), PAD.top + cH);
    ctx.closePath();

    ctx.fillStyle = 'rgba(36, 92, 69, 0.12)';
    ctx.fill();
  }

  // Line
  ctx.beginPath();
  ctx.strokeStyle = opts.color || '#245C45';
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';

  validValues.forEach((value, i) => {
    const x = getX(i);
    const y = getY(value);

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });

  ctx.stroke();

  // Data points
  validValues.forEach((value, i) => {
    const x = getX(i);
    const y = getY(value);

    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);

    ctx.fillStyle = '#fff';
    ctx.strokeStyle = opts.color || '#245C45';
    ctx.lineWidth = 2;

    ctx.fill();
    ctx.stroke();
  });
}


/* ═══════════════════════════════════════════════════════════════════
   DASHBOARD
═══════════════════════════════════════════════════════════════════ */

function renderDashChart() {
  const canvas = $('#dashChart');
  if (!canvas || !State.prodData.length) return;
  const labels = State.prodData.map(r => {
    const d = new Date(r.tanggal + 'T00:00:00');
    return `${d.getDate()}/${d.getMonth() + 1}`;
  });
  const values = State.prodData.map(r => parseFloat(r.persentase_produksi));
  drawLineChart(canvas, labels, values, { min: 60, max: 100, unit: '%', color: '#245C45' });
}

function initDashboard() {
  // KPI from ayam + produksi
  const totalChickens = State.ayamData.reduce((s, r) => s + parseInt(r.jumlah_ekor || 0), 0);
  // Weighted average age: weight each flock's age by its size (jumlah_ekor)
  const avgAge = (totalChickens > 0)
    ? (State.ayamData.reduce((s, r) => s + parseInt(r.umur_minggu || 0) * parseInt(r.jumlah_ekor || 0), 0) / totalChickens).toFixed(0)
    : '—';

  let latestEggs = 0;
  let latestHDP  = 0;
  if (State.prodData.length) {
    const last = State.prodData[State.prodData.length - 1];
    latestEggs = parseInt(last.jumlah_telur);
    latestHDP  = parseFloat(last.persentase_produksi).toFixed(1);
  }

  const elChickens = $('#kpiChickens');
  const elEggs     = $('#kpiEggs');
  const elAge      = $('#kpiAge');
  const elRate     = $('#kpiRate');
  if (elChickens) elChickens.textContent = totalChickens || 250;
  if (elEggs)     elEggs.textContent     = latestEggs    || 185;
  if (elAge)      elAge.textContent      = avgAge !== '—' ? `${avgAge} wks` : '—';
  if (elRate)     elRate.textContent     = latestHDP ? `${latestHDP}%` : '74%';

  // Flock list
  const flockList = $('#dashFlockList');
  if (flockList && State.ayamData.length) {
    flockList.innerHTML = '';
    State.ayamData.forEach(row => {
      const item = mk('div', { cls: 'flock-item' },
        mk('div', { cls: 'flock-item-id' }, row.id_ayam),
        mk('div', { cls: 'flock-item-name' }, row.jenis_ayam),
        mk('div', { cls: 'flock-item-meta' }, `${row.jumlah_ekor} hens · Age ${row.umur_minggu} wks`),
        mk('div', { cls: 'flock-item-status' }, row.status),
      );
      flockList.appendChild(item);
    });
  }

  renderDashChart();
}

/* ═══════════════════════════════════════════════════════════════════
   CHICKEN LIFECYCLE
═══════════════════════════════════════════════════════════════════ */

function initLifecycle() {
  const row = $('#lcStageRow');
  if (!row) return;

  if (!State.faseData.length) {
    showCSVError('#lcError', 'data_fase_ayam.csv could not be loaded.');
    return;
  }

  row.innerHTML = '';
  State.faseData.forEach((fase, idx) => {
    const card = mk('div', { cls: 'lc-card', role: 'listitem', tabindex: '0',
      'aria-label': `${fase.fase} stage, weeks ${fase.umur_min_minggu}–${fase.umur_max_minggu}` },
      mk('div', { cls: 'lc-card-num' }, String(idx + 1)),
      mk('div', { cls: 'lc-card-icon' }, FASE_ICONS[fase.fase] || '🐔'),
      mk('div', { cls: 'lc-card-name' }, fase.fase),
      mk('div', { cls: 'lc-card-age' }, `Wk ${fase.umur_min_minggu}–${fase.umur_max_minggu}`),
    );
    card.addEventListener('click', () => openLifecyclePanel(fase));
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLifecyclePanel(fase); }});
    row.appendChild(card);
  });
}

function openLifecyclePanel(fase) {
  // Highlight active card
  $$('.lc-card').forEach(c => c.classList.remove('active'));
  $$('.lc-card').forEach(c => {
    if (c.querySelector('.lc-card-name')?.textContent === fase.fase) c.classList.add('active');
  });

  const panel     = $('#lcPanel');
  const panelBody = $('#lcPanelBody');
  if (!panel || !panelBody) return;

  const extra = FASE_EXTRA[fase.fase] || {};
  panelBody.innerHTML = '';

  const textCol = mk('div', {},
    extra.tag ? mk('span', { cls: 'lc-panel-tag' }, extra.tag) : null,
    mk('h3', { cls: 'lc-panel-title' }, fase.fase),
    mk('p',  { cls: 'lc-panel-desc' }, fase.keterangan),
    mk('div', { cls: 'lc-chips' },
      mk('span', { cls: 'lc-chip' }, `Age: Wk ${fase.umur_min_minggu}–${fase.umur_max_minggu}`),
      mk('span', { cls: 'lc-chip' }, `Focus: ${fase.fokus_perawatan}`),
    ),
    extra.detail ? mk('p', { cls: 'lc-panel-desc', style: 'margin-top:8px;font-size:0.88rem;color:#57606a' }, extra.detail) : null,
  );
  const inner = mk('div', { cls: 'lc-panel-inner' },
    mk('div', { cls: 'lc-panel-icon' }, FASE_ICONS[fase.fase] || '🐔'),
    textCol,
  );

  panelBody.appendChild(inner);
  panel.style.display = 'block';

  // Feed section
  renderLifecycleFeed(fase);
}

function renderLifecycleFeed(fase) {
  const section = $('#lcFeedSection');
  const body    = $('#lcFeedBody');
  if (!section || !body) return;

  const feedRow = State.pakanData.find(r => r.fase === fase.fase);
  body.innerHTML = '';

  if (feedRow) {
    const table = mk('table', { cls: 'feed-table', role: 'table' },
      mk('thead', {},
        mk('tr', {},
          mk('th', {}, 'Phase'),
          mk('th', {}, 'Feed Type'),
          mk('th', {}, 'Est. g/bird/day'),
        )
      ),
      mk('tbody', {},
        mk('tr', {},
          mk('td', {}, mk('span', { cls: 'phase-pill' }, feedRow.fase)),
          mk('td', {}, feedRow.jenis_pakan),
          mk('td', {}, feedRow.estimasi_pakan_gram_per_ekor_per_hari),
        )
      )
    );
    body.appendChild(table);
    body.appendChild(mk('div', { cls: 'feed-note' }, `ℹ ${feedRow.catatan}`));
  } else {
    body.innerHTML = '<p style="color:#57606a;font-size:0.9rem">No feed data available for this phase.</p>';
  }

  section.style.display = 'block';
}

function initLifecyclePanel() {
  const closeBtn = $('#lcCloseBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      $('#lcPanel').style.display        = 'none';
      $('#lcFeedSection').style.display  = 'none';
      $$('.lc-card').forEach(c => c.classList.remove('active'));
    });
  }
}

/* ═══════════════════════════════════════════════════════════════════
   EGG FORMATION EXPLORER
═══════════════════════════════════════════════════════════════════ */

const EGG_STEPS = [
  {
    num: 1,
    title: 'Yolk Formation',
    dur: '~10 days',
    desc: 'Before ovulation, the developing yolk grows inside the ovary as layers of yolk material accumulate. It becomes rich in lipids, proteins, and fat-soluble nutrients.'
  },
  {
    num: 2,
    title: 'Ovulation',
    dur: '~15 min',
    desc: 'A mature follicle releases the yolk from the ovary following hormonal signals, including a surge in luteinising hormone (LH). The germinal disc sits on the yolk surface and may develop into an embryo if fertilisation occurs.'
  },
  {
    num: 3,
    title: 'Infundibulum',
    dur: '~15–20 min',
    desc: 'The funnel-shaped infundibulum captures the released yolk. Fertilisation can occur here if sperm are present. The yolk then enters the rest of the oviduct.'
  },
  {
    num: 4,
    title: 'Albumen and Chalaza Formation',
    dur: '~3 hours',
    desc: 'In the magnum, albumen (egg white) is secreted around the yolk. The chalazae form from specialised albumen proteins and twist into strands that help keep the yolk centred. Albumen consists mostly of water and contains important proteins.'
  },
  {
    num: 5,
    title: 'Shell Membranes',
    dur: '~1 hour',
    desc: 'In the isthmus, two protein-rich shell membranes form around the egg contents. These membranes provide structural protection and later separate at the blunt end to create the air cell.'
  },
  {
    num: 6,
    title: 'Shell Calcification',
    dur: '~17–20 hours',
    desc: 'In the uterus, also called the shell gland, calcium carbonate is deposited on the shell membranes to form the hard shell. Much of the calcium comes from the hen’s blood, supported by dietary calcium and bone reserves.'
  },
  {
    num: 7,
    title: 'Shell Pigmentation and Cuticle',
    dur: 'Final stage',
    desc: 'Shell pigments are deposited during the later stages of shell formation. Pigments such as protoporphyrin and biliverdin contribute to shell colour, depending on breed genetics. A thin cuticle is also deposited over the shell near the end of the process.'
  },
  {
    num: 8,
    title: 'Laying (Oviposition)',
    dur: '~1 min',
    desc: 'The completed egg passes through the vagina and is expelled through the cloaca. The blunt end commonly emerges first. The full process from ovulation to laying usually takes approximately 24–26 hours, although timing varies.'
  },
];

function initEggFormation() {
  const col = $('#eggStepsCol');
  if (!col) return;
  col.innerHTML = '';

  EGG_STEPS.forEach((step, idx) => {
    const item = mk('div', {
      cls: 'egg-step',
      role: 'listitem',
      tabindex: '0',
      'aria-label': `Step ${step.num}: ${step.title}`,
    },
      mk('div', { cls: 'egg-step-num' }, String(step.num)),
      mk('div', { cls: 'egg-step-body' },
        mk('h4', {}, step.title),
        mk('p', {}, step.desc),
      ),
      mk('span', { cls: 'egg-step-dur' }, step.dur),
    );

    item.addEventListener('click',   () => activateEggStep(idx, item));
    item.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activateEggStep(idx, item); }});
    col.appendChild(item);
  });
}

/**
 * Per-step highlight styles.
 * Index matches EGG_SVG_TARGETS.
 * Each entry maps target IDs to their highlight style object.
 * Unlisted targets receive the default gold glow.
 */
const EGG_STEP_STYLES = [
  // Step 1 – Yolk Formation
  {
    svgYolk: {
      filter: 'drop-shadow(0 0 8px rgba(230,160,20,0.95))',
      opacity: '1'
    }
  },

  // Step 2 – Ovulation
  {
    svgGerm: {
      filter: 'drop-shadow(0 0 7px rgba(242,201,76,0.95))',
      opacity: '1'
    }
  },

  // Step 3 – Infundibulums
{
    svgInfundibulum: {
        filter: 'drop-shadow(0 0 7px rgba(201,130,96,0.9))',
        opacity: '1'
    }
},

  // Step 4 – Albumen and Chalaza
  {
    svgAlbumen: {
      filter: 'drop-shadow(0 0 8px rgba(200,220,255,0.95))',
      opacity: '1'
    },
    svgChalaza: {
      filter: 'drop-shadow(0 0 6px rgba(242,201,76,0.9))',
      opacity: '1'
    }
  },

  // Step 5 – Shell Membranes
  {
    svgInnerMem: {
      filter: 'drop-shadow(0 0 6px rgba(100,200,180,0.9))',
      opacity: '1'
    },
    svgOuterMem: {
      filter: 'drop-shadow(0 0 6px rgba(100,200,180,0.9))',
      opacity: '1'
    }
  },

  // Step 6 – Shell Calcification
  {
    svgShell: {
      filter: 'drop-shadow(0 0 10px rgba(160,200,255,1))',
      opacity: '1'
    }
  },

  // Step 7 – Pigmentation and Cuticle
  {
    svgShell: {
      filter: 'drop-shadow(0 0 8px rgba(180,100,30,0.8))',
      opacity: '1'
    },
    svgPigment: {
      filter: 'none',
      opacity: '0.72',
      fill: 'rgba(160,90,30,0.28)',
      stroke: 'rgba(160,90,30,0.55)'
    }
  },

  // Step 8 – Laying
  {
    svgAir: {
      filter: 'drop-shadow(0 0 7px rgba(140,190,240,0.95))',
      opacity: '1'
    }
  },
];

/** All tracked SVG IDs including the pigment overlay */
const ALL_SVG_IDS = [
    'svgShell',
    'svgPigment',
    'svgOuterMem',
    'svgInnerMem',
    'svgAlbumen',
    'svgChalaza',
    'svgYolk',
    'svgGerm',
    'svgAir',
    'svgInfundibulum'
];

function activateEggStep(idx, clickedItem) {
  // Toggle active step
  $$('.egg-step').forEach(s => s.classList.remove('active'));
  clickedItem.classList.add('active');

  // Reset all SVG layers to default (svgPigment returns to fully transparent)
  ALL_SVG_IDS.forEach(id => {
    const el = $(`#${id}`);
    if (!el) return;
    el.style.filter  = '';
    el.style.opacity = id === 'svgPigment' ? '0' : '1';
    if (id === 'svgPigment') {
      el.setAttribute('fill',   'rgba(160,90,30,0)');
      el.setAttribute('stroke', 'rgba(160,90,30,0)');
    }
  });

  const targets  = EGG_SVG_TARGETS[idx] || [];
  const styleMap = EGG_STEP_STYLES[idx]  || {};

  // Apply highlight to each target
  targets.forEach(id => {
    const el = $(`#${id}`);
    if (!el) return;
    const s = styleMap[id] || { filter: 'drop-shadow(0 0 6px rgba(242,201,76,0.9))', opacity: '1' };
    el.style.filter  = s.filter;
    el.style.opacity = s.opacity;
    if (s.fill)   el.setAttribute('fill',   s.fill);
    if (s.stroke) el.setAttribute('stroke', s.stroke);
  });

  // Dim non-target layers (svgPigment stays at opacity 0 when not targeted)
  ALL_SVG_IDS
    .filter(id => !targets.includes(id))
    .forEach(id => {
      const el = $(`#${id}`);
      if (!el) return;
      el.style.opacity = id === 'svgPigment' ? '0' : '0.35';
    });
}

/* ═══════════════════════════════════════════════════════════════════
   POULTRY SIMULATION
═══════════════════════════════════════════════════════════════════ */

function initSimulation() {
  const runBtn = $('#simRunBtn');
  if (runBtn) runBtn.addEventListener('click', runSimulation);

  $('#simAge')?.addEventListener('input', () => validateSimInput('age'));
  $('#simQty')?.addEventListener('input', () => validateSimInput('qty'));
}

function validateSimInput(field) {
  if (field === 'age') {
    const v = parseInt($('#simAge').value);
    const hint = $('#simAgeHint');
    if (isNaN(v) || v < 0 || v > 100) {
      hint.textContent = 'Please enter a value between 0 and 100.';
      hint.style.color = '#b91c1c';
    } else {
      hint.textContent = '';
      hint.style.color = '';
    }
  }
  if (field === 'qty') {
    const v = parseInt($('#simQty').value);
    const hint = $('#simQtyHint');
    if (isNaN(v) || v < 1 || v > 50000) {
      hint.textContent = 'Please enter a value between 1 and 50,000.';
      hint.style.color = '#b91c1c';
    } else {
      hint.textContent = '';
      hint.style.color = '';
    }
  }
}

function runSimulation() {
  const ageRaw = $('#simAge')?.value.trim() ?? '';
  const qtyRaw = $('#simQty')?.value.trim() ?? '';

  const ageVal = ageRaw === '' ? NaN : Number(ageRaw);
  const qtyVal = qtyRaw === '' ? NaN : Number(qtyRaw);

  const results = $('#simResults');
  const ageHint = $('#simAgeHint');
  const qtyHint = $('#simQtyHint');

  if (!results) return;

  // Reset pesan validasi
  if (ageHint) {
    ageHint.textContent = '';
    ageHint.style.color = '';
  }

  if (qtyHint) {
    qtyHint.textContent = '';
    qtyHint.style.color = '';
  }

  results.innerHTML = '';

  // Validasi usia: boleh menggunakan angka desimal
  if (!Number.isFinite(ageVal) || ageVal < 0 || ageVal > 100) {
    if (ageHint) {
      ageHint.textContent =
        'Please enter a valid age (0–100 weeks).';
      ageHint.style.color = '#b91c1c';
    }
    return;
  }

  // Validasi jumlah ayam: wajib bilangan bulat
  if (
    !Number.isInteger(qtyVal) ||
    qtyVal < 1 ||
    qtyVal > 50000
  ) {
    if (qtyHint) {
      qtyHint.textContent =
        'Number of chickens must be a whole number (1–50,000).';
      qtyHint.style.color = '#b91c1c';
    }
    return;
  }

  // Cari fase ayam berdasarkan usia
  const phase = State.faseData.find(r =>
    ageVal >= Number(r.umur_min_minggu) &&
    ageVal <= Number(r.umur_max_minggu)
  );

  // Cari estimasi pakan berdasarkan usia
  const feed = State.pakanData.find(r =>
    ageVal >= Number(r.umur_min_minggu) &&
    ageVal <= Number(r.umur_max_minggu)
  );

  const phaseName = phase?.fase || 'Unknown';

  const feedGram = feed
    ? Number(feed.estimasi_pakan_gram_per_ekor_per_hari)
    : null;

  const totalFeedG = feedGram !== null
    ? feedGram * qtyVal
    : null;

  const totalFeedK = feedGram !== null
    ? (totalFeedG / 1000).toFixed(2)
    : null;

  // Rekomendasi perawatan berdasarkan fase
  const RECS = {
    'DOC': [
      ['🌡', 'Maintain brooder at 34–35 °C, reduce 0.5 °C/week'],
      ['💧', 'Provide clean water with electrolytes'],
      ['👁', 'Check chick condition every 4 hours']
    ],
    'Starter': [
      ['🌾', 'Switch to high-protein (18–20% CP) starter crumbles'],
      ['📏', 'Weigh a sample weekly to track growth'],
      ['🏠', 'Ensure adequate feeder space']
    ],
    'Grower': [
      ['🌿', 'Transition to grower pellets (15–16% CP)'],
      ['⚖', 'Compare body weight to breed standard'],
      ['💡', 'Maintain ~14 h light per day']
    ],
    'Pre-Layer': [
      ['🥚', 'Introduce pre-layer feed with increased calcium (2%)'],
      ['🪺', 'Install and clean nest boxes'],
      ['🔇', 'Minimise disturbances']
    ],
    'Layer': [
      ['🍽', 'Layer feed 16–17% CP, 3.5–4% calcium'],
      ['💡', '16 h light programme for peak production'],
      ['📊', 'Track HDP daily; investigate drops > 5%']
    ],
    'Unknown': [
      ['❓', 'Age is outside the defined simulation range (0–72 wks)'],
      ['📋', 'Review data_fase_ayam.csv for valid ranges']
    ]
  };

  const recs = RECS[phaseName] || RECS['Unknown'];

  // Bangun tampilan hasil
  const wrapper = mk(
    'div',
    { cls: 'sim-result' },
    mk(
      'span',
      { cls: 'sim-phase-badge' },
      `${FASE_ICONS[phaseName] || '🐔'} ${phaseName}`
    ),
    mk(
      'h3',
      { style: 'margin:12px 0 8px' },
      `Results for ${qtyVal.toLocaleString()} chickens at age ${ageVal} weeks`
    )
  );

  // KPI grid
  const grid = mk('div', { cls: 'sim-grid' });

  const boxes = [
    ['Phase', phaseName, ''],
    ['Age', `${ageVal} wks`, ''],
    ['Flock Size', qtyVal.toLocaleString(), 'birds'],
    ['Est. Feed/Bird/Day', feedGram ?? '—', 'g'],
    [
      'Est. Total Feed/Day',
      totalFeedG !== null
        ? Math.round(totalFeedG).toLocaleString()
        : '—',
      'g'
    ],
    ['Est. Feed/Day', totalFeedK ?? '—', 'kg']
  ];

  boxes.forEach(([label, value, unit]) => {
    grid.appendChild(
      mk(
        'div',
        { cls: 'sim-box' },
        mk('div', { cls: 'sim-box-label' }, label),
        mk('div', { cls: 'sim-box-value' }, String(value)),
        unit
          ? mk('div', { cls: 'sim-box-unit' }, unit)
          : null
      )
    );
  });

  wrapper.appendChild(grid);

  // Rekomendasi perawatan
  const recsDiv = mk(
    'div',
    { cls: 'sim-recs' },
    mk('div', { cls: 'sim-recs-title' }, '📋 Care Recommendations')
  );

  recs.forEach(([icon, text]) => {
    recsDiv.appendChild(
      mk(
        'div',
        { cls: 'sim-rec' },
        mk(
          'span',
          { cls: 'sim-rec-icon', 'aria-hidden': 'true' },
          icon
        ),
        mk('span', {}, text)
      )
    );
  });

  wrapper.appendChild(recsDiv);

  // Disclaimer
  wrapper.appendChild(
    mk(
      'p',
      { cls: 'sim-disclaimer' },
      '⚠ These are illustrative estimates for educational purposes only. Actual requirements vary by breed, environment, and feed quality. Consult a qualified poultry specialist before making farm decisions.'
    )
  );

  results.appendChild(wrapper);
}


/* ═══════════════════════════════════════════════════════════════════
   SMART POULTRY AI  —  Demo chatbot
   ─────────────────────────────────────────────────────────────────
   TO CONNECT A REAL AI API:
   Replace the body of `getAIResponse(question)` below with a call
   to your chosen LLM endpoint (e.g. IBM watsonx, OpenAI, Gemini).
   The function must return a Promise that resolves to a string.
═══════════════════════════════════════════════════════════════════ */

const AI_KB = [
  { keys: ['phase','fase','stage','doc','starter','grower','layer','pre-layer','lifecycle'],
    ans: '🐔 Laying hens go through 5 phases: DOC (0–6 wks), Starter (7–8 wks), Grower (9–16 wks), Pre-Layer (17–18 wks), and Layer (19–72 wks). Each phase has specific feed and management needs.' },
  { keys: ['feed','pakan','gram','nutrition','protein'],
    ans: '🌾 Feed estimates (per bird/day): DOC ~20 g · Starter ~35 g · Grower ~60 g · Pre-Layer ~85 g · Layer ~110 g. These are illustrative values — actual amounts depend on breed and environment.' },
  { keys: ['egg','telur','production','hdp','hen day'],
    ans: '🥚 Hen Day Production (HDP) = (eggs collected ÷ hens present) × 100. Good commercial layers achieve 75–85% HDP during peak production (weeks 24–40).' },
  { keys: ['calcium','cal','shell','cangkang','mineral'],
    ans: '🧪 Laying hens need 3.5–4 g calcium/day for shell formation. Layer feeds typically contain 3.5–4% calcium. Supplementing with oyster shell can help maintain shell quality.' },
  { keys: ['health','sick','disease','penyakit','sakit','symptom'],
    ans: '🩺 For health concerns, please visit the Chicken Health module. Remember: this assistant provides educational information only — always consult a qualified veterinarian for diagnosis and treatment.' },
  { keys: ['water','air','minum','drink','hydration'],
    ans: '💧 Laying hens drink approximately 200–300 ml of water per day at 20°C. Adequate clean water access is critical — water deprivation reduces egg production faster than feed deprivation.' },
  { keys: ['light','cahaya','lamp','lighting','photoperiod'],
    ans: '💡 A 16-hour light programme is recommended for peak egg production. Use 10–20 lux at bird eye level. Abrupt light changes cause stress — adjust gradually.' },
  { keys: ['temperature','suhu','heat','cold','stress'],
    ans: '🌡 Optimal laying temperature is 18–24°C. Heat stress (>30°C) reduces feed intake and shell quality. Ensure good ventilation, shade, and cool water during hot weather.' },
  { keys: ['breed','strain','ras','jenis','isa','lohmann'],
    ans: '🐓 Common commercial laying breeds include Isa Brown, Lohmann Brown, and Novogen Brown (brown-egg producers) and Lohmann White, Hy-Line W36 (white-egg). Breed selection affects feed conversion and peak HDP.' },
  { keys: ['fcr','feed conversion','konversi','efisiensi'],
    ans: '📊 Feed Conversion Ratio (FCR) for layers = total feed consumed ÷ total eggs (by weight). A typical FCR for eggs is 2.0–2.5 kg feed per kg of egg. Lower FCR = better efficiency.' },
];

const EXAMPLE_QUESTIONS = [
  'What are the growth phases of laying hens?',
  'How much feed does a Layer-phase hen need per day?',
  'How do I calculate Hen Day Production (HDP)?',
  'Why is calcium important for laying hens?',
  'What should I do if a hen shows health symptoms?',
  'How much water do laying hens need?',
  'What lighting programme is best for egg production?',
  'How does temperature affect egg production?',
  'What are common commercial laying hen breeds?',
  'How do I calculate Feed Conversion Ratio (FCR)?',
];

/**
 * AI INTEGRATION POINT
 * Replace the body of this function to connect a real AI API.
 * @param {string} question - The user's input text
 * @returns {Promise<string>} - Resolves to the response text (HTML allowed)
 */
async function getAIResponse(question) {
  // ── DEMO KNOWLEDGE BASE LOOKUP ──────────────────────────────────
  // This block provides pre-programmed educational responses.
  // Delete everything inside this function and replace with your
  // real API call (e.g. fetch to IBM watsonx, OpenAI, etc.)
  // ────────────────────────────────────────────────────────────────

  await new Promise(r => setTimeout(r, 800 + Math.random() * 600)); // simulate latency

  const q = question.toLowerCase();

  for (const entry of AI_KB) {
    if (entry.keys.some(k => q.includes(k))) {
      return entry.ans;
    }
  }

  // Fallback
  return `I don't have a specific pre-programmed answer for "<em>${escapeHtml(question)}</em>" in this demonstration version. Try asking about: growth phases, feed requirements, egg production, calcium, health, water, lighting, temperature, breeds, or FCR.<br><br><small>To connect a real AI API, replace <code>getAIResponse()</code> in <code>script.js</code>.</small>`;
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function appendChatMsg(role, html) {
  const messages = $('#chatMessages');
  if (!messages) return;
  const msg = mk('div', { cls: `chat-msg ${role}` },
    mk('div', { cls: 'chat-avatar', 'aria-hidden': 'true' }, role === 'bot' ? 'AI' : 'You'),
    mk('div', { cls: 'chat-bubble' }),
  );
  msg.querySelector('.chat-bubble').innerHTML = html;
  messages.appendChild(msg);
  messages.scrollTop = messages.scrollHeight;
  return msg;
}

async function sendChatMessage(text) {
  const q = text.trim();
  if (!q) return;

  const input = $('#chatInput');
  const sendBtn = $('#chatSendBtn');
  if (input) input.value = '';
  if (sendBtn) sendBtn.disabled = true;

  appendChatMsg('user', escapeHtml(q));

  // Thinking indicator
  const thinking = mk('div', { cls: 'chat-msg bot chat-thinking' },
    mk('div', { cls: 'chat-avatar', 'aria-hidden': 'true' }, 'AI'),
    mk('div', { cls: 'chat-bubble' }, '⌛ Thinking…'),
  );
  $('#chatMessages').appendChild(thinking);
  $('#chatMessages').scrollTop = $('#chatMessages').scrollHeight;

  try {
    const answer = await getAIResponse(q);
    thinking.remove();
    appendChatMsg('bot', answer);
  } catch (err) {
    thinking.remove();
    appendChatMsg('bot', '⚠ Sorry, the assistant encountered an error. Please try again.');
  } finally {
    if (sendBtn) sendBtn.disabled = false;
    if (input) input.focus();
  }
}

function initAI() {
  const sendBtn = $('#chatSendBtn');
  const input   = $('#chatInput');
  const eqContainer = $('#exampleQs');

  if (sendBtn) sendBtn.addEventListener('click', () => sendChatMessage(input?.value || ''));
  if (input)   input.addEventListener('keydown', e => { if (e.key === 'Enter') sendChatMessage(input.value); });

  // Render example questions
  if (eqContainer) {
    EXAMPLE_QUESTIONS.forEach(q => {
      const btn = mk('button', { cls: 'eq-btn', type: 'button' }, q);
      btn.addEventListener('click', () => sendChatMessage(q));
      eqContainer.appendChild(btn);
    });
  }
}

/* ═══════════════════════════════════════════════════════════════════
   EGG PRODUCTION MONITORING
═══════════════════════════════════════════════════════════════════ */

/** Load persisted user logs from localStorage */
function loadProdLogs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

/** Persist user logs to localStorage */
function saveProdLogs(logs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  } catch { /* quota exceeded — silently ignore */ }
}

/**
 * Build State.prodLogs by merging CSV seed data with user-added records
 * from localStorage. CSV records are tagged { source: 'csv' } and are
 * never written to or deleted from data_produksi.csv.
 *
 * Precedence rule: if a user record exists for a given date, the CSV
 * record for that same date is suppressed from State.prodLogs so only
 * one row per date is shown. Deleting the user record causes the CSV
 * record to reappear on the next call to this function.
 */
function seedProdFromCSV() {
  const userLogs   = loadProdLogs().filter(l => l.source !== 'csv');
  const userDates  = new Set(userLogs.map(l => l.date));

  const csvLogs = State.prodData
    .filter(r => !userDates.has(r.tanggal))   // suppress CSV rows covered by a user record
    .map(r => ({
      id:     `csv_${r.tanggal}`,
      date:   r.tanggal,
      flock:  parseInt(r.jumlah_ayam_layer),
      eggs:   parseInt(r.jumlah_telur),
      feed:   '',
      mort:   0,
      hdp:    parseFloat(r.persentase_produksi),
      fcr:    '',
      source: 'csv',
    }));

  // Merge: visible CSV rows + all user rows, then sort ascending by date
  State.prodLogs = [...csvLogs, ...userLogs];
  State.prodLogs.sort((a, b) => a.date.localeCompare(b.date));
}

function renderProdTable() {
  const tbody  = $('#prodTbody');
  const empty  = $('#prodEmpty');
  if (!tbody) return;

  tbody.innerHTML = '';
  const logs = State.prodLogs;

  if (!logs.length) {
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  // Show last 14 records (most recent first for table)
  const recent = [...logs].reverse().slice(0, 14);
  recent.forEach(log => {
    const hdpClass = log.hdp >= 75 ? 'hdp-good' : log.hdp >= 65 ? 'hdp-warn' : 'hdp-bad';
    const tr = mk('tr', {},
      mk('td', {}, log.date),
      mk('td', {}, log.flock),
      mk('td', {}, log.eggs),
      mk('td', {}, log.feed !== '' ? log.feed : '—'),
      mk('td', {}, mk('span', { cls: hdpClass }, `${log.hdp.toFixed(1)}%`)),
      mk('td', {}, log.fcr !== '' ? log.fcr : '—'),
      mk('td', {},
        log.source !== 'csv'
          ? mk('button', { cls: 'btn-del', 'aria-label': `Delete record ${log.date}`,
              onclick: () => deleteProdLog(log.id) }, '✕')
          : mk('span', { cls: 'src-tag', title: 'Pre-loaded from CSV' }, 'CSV'),
      ),
    );
    tbody.appendChild(tr);
  });
}

function renderProdChart() {
  const canvas = $('#prodChart');
  if (!canvas) return;

  // Always clear the canvas first so no previous chart lingers
  const ctx = canvas.getContext('2d');
  const W   = canvas.offsetWidth  || 600;
  const H   = canvas.offsetHeight || 220;
  canvas.width  = W;
  canvas.height = H;
  ctx.clearRect(0, 0, W, H);

  if (!State.prodLogs.length) return;   // nothing to draw — canvas is now blank

  const last14 = State.prodLogs.slice(-14);
  const labels = last14.map(r => {
    const d = new Date(r.date + 'T00:00:00');
    return `${d.getDate()}/${d.getMonth() + 1}`;
  });
  const values = last14.map(r => r.hdp);
  drawLineChart(canvas, labels, values, { min: 50, max: 100, unit: '%', color: '#245C45' });
}


function updateProdSummary() {
  const logs = State.prodLogs;

  const elHDP    = $('#sumHDP');
  const elAvgHDP = $('#sumAvgHDP');
  const elTotal  = $('#sumTotal');
  const elFCR    = $('#sumFCR');
  const trendEl  = $('#trendLine');

  // Reset KPI jika tidak ada data
  if (!logs.length) {
    if (elHDP) elHDP.textContent = '—';
    if (elAvgHDP) elAvgHDP.textContent = '—';
    if (elTotal) elTotal.textContent = '—';
    if (elFCR) elFCR.textContent = '—';

    if (trendEl) {
      trendEl.textContent = '';
      trendEl.classList.remove('visible');
    }
    return;
  }

  // Data sudah diurutkan dari tanggal lama ke terbaru
  const last = logs[logs.length - 1];
  const latestDate = last.date;

  // Ambil rentang 7 hari kalender, termasuk tanggal terbaru
  const endDate = new Date(`${latestDate}T00:00:00Z`);
  const startDate = new Date(endDate);
  startDate.setUTCDate(startDate.getUTCDate() - 6);

  const startDateString = startDate.toISOString().slice(0, 10);

  const last7 = logs.filter(log =>
    log.date >= startDateString &&
    log.date <= latestDate
  );

  // Latest HDP
  if (elHDP) {
    elHDP.textContent = `${Number(last.hdp).toFixed(1)}%`;
  }

  // Average HDP dari catatan yang tersedia dalam 7 hari kalender
  const avgHDP = last7.reduce(
    (sum, log) => sum + Number(log.hdp || 0),
    0
  ) / last7.length;

  if (elAvgHDP) {
    elAvgHDP.textContent = `${avgHDP.toFixed(1)}%`;
  }

  // Total eggs dalam 7 hari kalender
  const totalEgg = last7.reduce(
    (sum, log) => sum + Number(log.eggs || 0),
    0
  );

  if (elTotal) {
    elTotal.textContent = totalEgg.toLocaleString();
  }

  // FCR hanya menggunakan catatan dengan data pakan positif
  const logsWithFeed = last7.filter(
    log => log.feed !== '' &&
           Number.isFinite(Number(log.feed)) &&
           Number(log.feed) > 0
  );

  const totalFeedKg = logsWithFeed.reduce(
    (sum, log) => sum + Number(log.feed),
    0
  );

  // Asumsi bobot telur: 60 gram per butir
  const totalEggKg = logsWithFeed.reduce(
    (sum, log) => sum + Number(log.eggs || 0) * 0.06,
    0
  );

  if (elFCR) {
    elFCR.textContent = totalEggKg > 0
      ? (totalFeedKg / totalEggKg).toFixed(2)
      : '—';
  }

  // Tren berdasarkan maksimal 3 catatan terbaru dalam periode
  if (trendEl) {
    trendEl.textContent = '';
    trendEl.classList.remove('visible');

    if (last7.length >= 3) {
      const recent3 = last7
        .slice(-3)
        .map(log => Number(log.hdp));

      const trend = recent3[2] - recent3[0];

      let message;

      if (trend > 2) {
        message = '📈 Production trending upward over the last 3 records.';
      } else if (trend < -2) {
        message = '📉 Production trending downward. Review feed and flock conditions.';
      } else {
        message = '➡ Production stable over the last 3 records.';
      }

      trendEl.textContent = message;
      trendEl.classList.add('visible');
    }
  }
}



function addProdLog() {
  const dateEl   = $('#prodDate');
  const flockEl  = $('#prodFlock');
  const eggsEl   = $('#prodEggs');
  const feedEl   = $('#prodFeed');
  const mortEl   = $('#prodMort');
  const feedback = $('#prodFeedback');

  const date = dateEl?.value ?? '';

  const flockRaw = flockEl?.value.trim() ?? '';
  const eggsRaw  = eggsEl?.value.trim() ?? '';
  const feedRaw  = feedEl?.value.trim() ?? '';
  const mortRaw  = mortEl?.value.trim() ?? '';

  const flock = flockRaw === '' ? NaN : Number(flockRaw);
  const eggs  = eggsRaw === '' ? NaN : Number(eggsRaw);
  const feed  = feedRaw === '' ? '' : Number(feedRaw);
  const mort  = mortRaw === '' ? 0 : Number(mortRaw);

  // Validation
  const errors = [];

  if (!date) {
    errors.push('Date is required.');
  }

  if (!Number.isInteger(flock) || flock < 1) {
    errors.push('Flock size must be a positive whole number.');
  }

  if (eggsRaw === '') {
    errors.push('Eggs collected is required.');
  } else if (!Number.isInteger(eggs) || eggs < 0) {
    errors.push('Eggs collected must be a non-negative whole number.');
  }

  if (Number.isInteger(eggs) && Number.isInteger(flock) && eggs > flock) {
    errors.push('Eggs collected cannot exceed flock size.');
  }

  if (feed !== '' && (!Number.isFinite(feed) || feed < 0)) {
    errors.push('Feed consumed must be a valid non-negative number.');
  }

  if (!Number.isInteger(mort) || mort < 0) {
    errors.push('Mortality must be a whole number of 0 or more.');
  }

  if (Number.isInteger(mort) && Number.isInteger(flock) && mort > flock) {
    errors.push('Mortality cannot exceed flock size.');
  }

  // Stop if validation fails
  if (errors.length > 0) {
    if (feedback) {
      feedback.textContent = errors.join(' ');
      feedback.className = 'form-feedback err';
    }
    return;
  }

  // Duplicate check
  const exists = State.prodLogs.find(
    l => l.date === date && l.source !== 'csv'
  );

  if (exists) {
    if (feedback) {
      feedback.textContent =
        `A user record for ${date} already exists. Delete it first to update.`;
      feedback.className = 'form-feedback err';
    }
    return;
  }

  // Calculate HDP
  const hdp = parseFloat(((eggs / flock) * 100).toFixed(2));

  // FCR = feed (kg) / egg mass (kg)
  // Egg mass assumption: 60 g per egg (illustrative).
  const fcr = (feed !== '' && eggs > 0)
    ? (feed / (eggs * 0.060)).toFixed(2)
    : '';

  const newLog = {
    id: `user_${date}_${Date.now()}`,
    date,
    flock,
    eggs,
    feed,
    mort,
    hdp,
    fcr,
    source: 'user',
  };

  // Save record
  saveProdLogs([
    ...loadProdLogs().filter(l => l.source !== 'csv'),
    newLog
  ]);

  seedProdFromCSV();

  // Reset form using local date
  const now = new Date();
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('-');

  if (dateEl) dateEl.value = today;
  if (flockEl) flockEl.value = '';
  if (eggsEl) eggsEl.value = '';
  if (feedEl) feedEl.value = '';
  if (mortEl) mortEl.value = '0';

  // Success feedback
  if (feedback) {
    feedback.textContent = `✓ Record for ${date} added successfully.`;
    feedback.className = 'form-feedback ok';

    setTimeout(() => {
      feedback.textContent = '';
      feedback.className = 'form-feedback';
    }, 3500);
  }

  // Refresh production display
  renderProdTable();
  renderProdChart();
  updateProdSummary();
}


function deleteProdLog(id) {
  if (!confirm('Delete this record?')) return;
  // Persist the remaining user records first, then rebuild State.prodLogs so
  // the CSV entry for the deleted date reappears automatically.
  const remainingUser = State.prodLogs.filter(l => l.id !== id && l.source !== 'csv');
  saveProdLogs(remainingUser);
  seedProdFromCSV();
  renderProdTable();
  renderProdChart();
  updateProdSummary();
}

function initProduction() {
  seedProdFromCSV();

  const addBtn   = $('#prodAddBtn');
  const clearBtn = $('#clearBtn');
  if (addBtn)   addBtn.addEventListener('click',   addProdLog);
 if (clearBtn) clearBtn.addEventListener('click', () => {
  if (!confirm('Clear all your manually added records? CSV seed data will remain.')) {
    return;
  }

  saveProdLogs([]);
  seedProdFromCSV();

  renderProdTable();
  renderProdChart();
  updateProdSummary();
});

  // Set default date to today
  const dateEl = $('#prodDate');
  if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];

  renderProdTable();
  renderProdChart();
  updateProdSummary();
}

/* ═══════════════════════════════════════════════════════════════════
   CHICKEN HEALTH
═══════════════════════════════════════════════════════════════════ */

function renderHealthCards(data) {
  const grid = $('#healthGrid');
  const empty = $('#healthEmpty');

  if (!grid) return;

  grid.innerHTML = '';

  if (!Array.isArray(data) || data.length === 0) {
    if (empty) empty.style.display = 'block';
    return;
  }

  if (empty) empty.style.display = 'none';

  data.forEach(row => {
    const id = String(row.id_kasus ?? 'N/A');
    const symptom = String(row.gejala_umum ?? 'No symptom description');
    const cause = String(row.kemungkinan_penyebab_umum ?? 'No information available');
    const action = String(row.tindakan_awal_aman ?? 'No observation available');
    const escalation = String(
      row.eskalasi ?? 'Consult a qualified poultry veterinarian.'
    );

    const card = mk(
      'div',
      {
        cls: 'health-card',
        role: 'article',
        'aria-label': `Health case ${id}`
      },
      mk('div', { cls: 'health-card-head' },
        mk('span', { cls: 'health-id' }, id),
        mk('h4', {}, symptom)
      ),
      mk('div', { cls: 'health-card-body' },
        mk('div', {},
          mk('span', { cls: 'health-row-label' }, 'Possible cause: '),
          mk('span', { cls: 'health-row-text' }, cause)
        ),
        mk('div', {},
          mk('span', { cls: 'health-row-label' }, 'Initial observation: '),
          mk('span', { cls: 'health-row-text' }, action)
        ),
        mk('div', { cls: 'health-escalation' },
          mk('strong', {}, '🩺 Escalation: '),
          mk('span', {}, escalation)
        )
      )
    );

    grid.appendChild(card);
  });
}


function initHealth() {
  if (!State.kesehatanData.length) {
    showCSVError(
      '#healthError',
      'data_kesehatan.csv could not be loaded or contains no records.'
    );
    return;
  }

  renderHealthCards(State.kesehatanData);

  const keywords = [
    'Nafsu makan',
    'Bulu',
    'Produksi',
    'Lesu',
    'Semua'
  ];

  const filterRow = $('#healthFilters');

  if (filterRow) {
    filterRow.innerHTML = '';

    keywords.forEach(kw => {
      const chip = mk(
        'button',
        {
          cls: `filter-chip${kw === 'Semua' ? ' active' : ''}`,
          type: 'button',
          'data-kw': kw
        },
        kw
      );

      chip.addEventListener('click', () => {
        $$('#healthFilters .filter-chip').forEach(btn => {
          btn.classList.remove('active');
        });

        chip.classList.add('active');
        filterHealth();
      });

      filterRow.appendChild(chip);
    });
  }

  $('#healthSearch')?.addEventListener('input', filterHealth);
}


function filterHealth() {
  const searchInput = $('#healthSearch');

  const q = (searchInput?.value || '')
    .trim()
    .toLowerCase();

  const kwBtn = $('#healthFilters .filter-chip.active');
  const kw = (kwBtn?.dataset.kw || 'Semua').toLowerCase();

  const filtered = State.kesehatanData.filter(row => {
    const symptom = String(row.gejala_umum ?? '').toLowerCase();
    const cause = String(row.kemungkinan_penyebab_umum ?? '').toLowerCase();
    const action = String(row.tindakan_awal_aman ?? '').toLowerCase();
    const escalation = String(row.eskalasi ?? '').toLowerCase();

    const matchKw =
      kw === 'semua' || symptom.includes(kw);

    const matchQ = !q || [
      symptom,
      cause,
      action,
      escalation
    ].some(value => value.includes(q));

    return matchKw && matchQ;
  });

  renderHealthCards(filtered);
}

function initHealth() {
  if (!State.kesehatanData.length) {
    showCSVError('#healthError', 'data_kesehatan.csv could not be loaded.');
    return;
  }

  // Render all cards initially
  renderHealthCards(State.kesehatanData);

  // Build filter chips from unique symptom keywords
  const keywords = ['Nafsu makan', 'Bulu', 'Produksi', 'Lesu', 'Semua'];
  const filterRow = $('#healthFilters');
  if (filterRow) {
    filterRow.innerHTML = '';
    keywords.forEach(kw => {
      const chip = mk('button', { cls: `filter-chip${kw === 'Semua' ? ' active' : ''}`, type: 'button', 'data-kw': kw }, kw);
      chip.addEventListener('click', () => {
        $$('#healthFilters .filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        filterHealth();
      });
      filterRow.appendChild(chip);
    });
  }

  $('#healthSearch')?.addEventListener('input', filterHealth);
}

function filterHealth() {
  const q     = ($('#healthSearch')?.value || '').toLowerCase();
  const kwBtn = $('#healthFilters .filter-chip.active');
  const kw    = kwBtn?.dataset.kw || 'Semua';

  const filtered = State.kesehatanData.filter(row => {
    const matchKw  = kw === 'Semua' || row.gejala_umum.toLowerCase().includes(kw.toLowerCase());
    const matchQ   = !q ||
      row.gejala_umum.toLowerCase().includes(q) ||
      row.kemungkinan_penyebab_umum.toLowerCase().includes(q) ||
      row.tindakan_awal_aman.toLowerCase().includes(q);
    return matchKw && matchQ;
  });
  renderHealthCards(filtered);
}


/* ═══════════════════════════════════════════════════════════════════
   LEARNING RESOURCES
═══════════════════════════════════════════════════════════════════ */

function renderLearningAccordion(data) {
  const acc = $('#learningAccordion');
  const empty = $('#learningEmpty');

  if (!acc) return;

  acc.innerHTML = '';

  if (!Array.isArray(data) || data.length === 0) {
    if (empty) empty.style.display = 'block';
    return;
  }

  if (empty) empty.style.display = 'none';

  data.forEach((row, index) => {
    const id = String(row.id ?? `learning-${index}`);
    const category = String(row.kategori ?? 'Uncategorized');
    const question = String(row.pertanyaan ?? 'Question unavailable');
    const answer = String(row.jawaban ?? 'Answer unavailable');

    const item = mk('div', {
      cls: 'acc-item',
      role: 'listitem'
    });

    const triggerId = `acc-trigger-${id}-${index}`;
    const bodyId = `acc-body-${id}-${index}`;

    const trigger = mk(
      'button',
      {
        cls: 'acc-trigger',
        type: 'button',
        id: triggerId,
        'aria-expanded': 'false',
        'aria-controls': bodyId
      },
      mk('span', { cls: 'acc-trigger-left' },
        mk('span', { cls: 'acc-cat' }, category),
        mk('span', { cls: 'acc-q' }, question)
      ),
      mk('span', {
        cls: 'acc-chevron',
        'aria-hidden': 'true'
      }, '▾')
    );

    const body = mk(
      'div',
      {
        cls: 'acc-body',
        id: bodyId,
        role: 'region',
        'aria-labelledby': triggerId
      },
      mk('p', { cls: 'acc-answer' }, answer)
    );

    trigger.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');

      // Close other accordion items
      $$('.acc-item.open').forEach(openItem => {
        openItem.classList.remove('open');

        const openTrigger = openItem.querySelector('.acc-trigger');
        const openBody = openItem.querySelector('.acc-body');

        openTrigger?.setAttribute('aria-expanded', 'false');

        if (openBody) {
          openBody.style.maxHeight = '';
        }
      });

      // Open selected item
      if (!isOpen) {
        item.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
        body.style.maxHeight = `${body.scrollHeight}px`;
      }
    });

    item.append(trigger, body);
    acc.appendChild(item);
  });
}


function initLearning() {
  if (!Array.isArray(State.pengetahuanData) ||
      State.pengetahuanData.length === 0) {
    showCSVError(
      '#learningError',
      'data_pengetahuan.csv could not be loaded or contains no records.'
    );
    return;
  }

  renderLearningAccordion(State.pengetahuanData);

  // Build category filter chips
  const uniqueCategories = [
    ...new Set(
      State.pengetahuanData
        .map(row => String(row.kategori ?? '').trim())
        .filter(category => category !== '')
    )
  ];

  const categories = ['Semua', ...uniqueCategories];
  const filterRow = $('#learningFilters');

  if (filterRow) {
    filterRow.innerHTML = '';

    categories.forEach(category => {
      const chip = mk(
        'button',
        {
          cls: `filter-chip${category === 'Semua' ? ' active' : ''}`,
          type: 'button',
          'data-cat': category
        },
        category
      );

      chip.addEventListener('click', () => {
        $$('#learningFilters .filter-chip').forEach(button => {
          button.classList.remove('active');
        });

        chip.classList.add('active');
        filterLearning();
      });

      filterRow.appendChild(chip);
    });
  }

  $('#learningSearch')?.addEventListener('input', filterLearning);
}


function filterLearning() {
  const searchInput = $('#learningSearch');

  const q = (searchInput?.value || '')
    .trim()
    .toLowerCase();

  const catBtn = $('#learningFilters .filter-chip.active');
  const cat = catBtn?.dataset.cat || 'Semua';

  const filtered = State.pengetahuanData.filter(row => {
    const category = String(row.kategori ?? '');
    const question = String(row.pertanyaan ?? '');
    const answer = String(row.jawaban ?? '');

    const matchCat =
      cat === 'Semua' || category === cat;

    const matchQ = !q || [
      category,
      question,
      answer
    ].some(value => value.toLowerCase().includes(q));

    return matchCat && matchQ;
  });

  renderLearningAccordion(filtered);
}


/* ═══════════════════════════════════════════════════════════════════
   RESIZE HANDLER  —  redraw charts on window resize
═══════════════════════════════════════════════════════════════════ */

let _resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => {
    const activePage = $('.page.active')?.id?.replace('page-', '');
    if (activePage === 'dashboard')  renderDashChart();
    if (activePage === 'production') renderProdChart();
  }, 200);
});

/* ═══════════════════════════════════════════════════════════════════
   BOOTSTRAP  —  DOMContentLoaded
═══════════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', async () => {

  // 1. Init sidebar & navigation first so the UI is interactive immediately
  initSidebar();
  initNavigation();
  initSearch();
  initNotifications();
  initUserProfile();

  // 2. Load all CSVs in parallel (fail-safe: allSettled)
  const [
    ayamResult,
    faseResult,
    pakanResult,
    prodResult,
    kesehatanResult,
    pengetahuanResult,
  ] = await Promise.allSettled([
    loadCSV('data_ayam.csv'),
    loadCSV('data_fase_ayam.csv'),
    loadCSV('data_pakan.csv'),
    loadCSV('data_produksi.csv'),
    loadCSV('data_kesehatan.csv'),
    loadCSV('data_pengetahuan.csv'),
  ]);

  // Store results — warn on failure but continue
  if (ayamResult.status        === 'fulfilled') State.ayamData         = ayamResult.value;
  if (faseResult.status        === 'fulfilled') State.faseData         = faseResult.value;
  if (pakanResult.status       === 'fulfilled') State.pakanData        = pakanResult.value;
  if (prodResult.status        === 'fulfilled') State.prodData         = prodResult.value;
  else showCSVError('#prodError', 'data_produksi.csv could not be loaded. Production chart and CSV records unavailable.');
  if (kesehatanResult.status   === 'fulfilled') State.kesehatanData    = kesehatanResult.value;
  if (pengetahuanResult.status === 'fulfilled') State.pengetahuanData  = pengetahuanResult.value;

  // 3. Initialise each module
  initDashboard();
  initLifecycle();
  initLifecyclePanel();
  initEggFormation();
  initSimulation();
  initAI();
  initProduction();
  initHealth();
  initLearning();

  console.info('SIKLUSAYAM loaded. All data is demonstration/simulated. AI Builders Challenge 2026.');
});





function initUserProfile() {
  const btn = $('#userProfileBtn');
  const menu = $('#userProfileMenu');
  const modal = $('#profileModal');
  const closeBtn = $('#profileModalClose');
  const doneBtn = $('#profileModalDone');

  if (!btn || !menu) return;

  // Menutup dropdown
  function closeMenu() {
    menu.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
  }

  // Menutup modal profil
  function closeProfile() {
    if (modal) {
      modal.hidden = true;
    }
  }

  // Membuka dan menutup dropdown
  btn.addEventListener('click', event => {
    event.stopPropagation();

    menu.hidden = !menu.hidden;
    btn.setAttribute('aria-expanded', String(!menu.hidden));
  });

  // Menutup dropdown ketika klik di luar
  document.addEventListener('click', event => {
    if (!event.target.closest('.user-profile-wrapper')) {
      closeMenu();
    }
  });

  // Menangani menu Profil Admin saja
  menu.addEventListener('click', event => {
    const actionBtn = event.target.closest('[data-profile-action]');

    if (!actionBtn) return;

    const action = actionBtn.dataset.profileAction;

    closeMenu();

    if (action === 'profile' && modal) {
      modal.hidden = false;
    }
  });

  // Tombol tutup modal
  closeBtn?.addEventListener('click', closeProfile);
  doneBtn?.addEventListener('click', closeProfile);

  // Menutup modal ketika klik area luar
  modal?.addEventListener('click', event => {
    if (event.target === modal) {
      closeProfile();
    }
  });

  // Menutup modal menggunakan tombol Escape
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeProfile();
      closeMenu();
    }
  });
}




