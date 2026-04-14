/* ═══════════════════════════════════════════════════════════════════════════
   GHI Forecasting · Koshi Province · Kathmandu University
   app.js — Data, chart rendering, interactions
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';

let DATA        = null;
let activeYear  = '2025';
let activeMonth = '01';

// Year palettes — warm, distinct, non-generic
const YEAR_COLORS = {
  '2025': '#E06B6B',
  '2026': '#D4894A',
  '2027': '#5DB88A',
  '2028': '#5B9BD5',
  '2029': '#9B7EC8',
};
const CLEARSKY_COL = '#CC8822';
const AMBER        = '#CC8822';

// ── Plotly base ───────────────────────────────────────────────────────────────
const BASE = {
  paper_bgcolor: 'transparent',
  plot_bgcolor:  'transparent',
  font: {
    family: "'Space Mono', monospace",
    color:  '#6A5F56',
    size:   10,
  },
  margin: { t: 12, b: 44, l: 60, r: 12 },
  xaxis: {
    showgrid:      true,
    gridcolor:     'rgba(255,255,255,0.035)',
    linecolor:     'rgba(255,255,255,0.06)',
    tickcolor:     'rgba(255,255,255,0.06)',
    zerolinecolor: 'transparent',
    tickfont:      { size: 9, family: "'Space Mono', monospace" },
  },
  yaxis: {
    showgrid:      true,
    gridcolor:     'rgba(255,255,255,0.035)',
    linecolor:     'rgba(255,255,255,0.06)',
    zerolinecolor: 'transparent',
    rangemode:     'tozero',
    tickfont:      { size: 9, family: "'Space Mono', monospace" },
  },
  legend: {
    bgcolor:     'transparent',
    borderwidth: 0,
    font:        { size: 10, color: '#6A5F56', family: "'Space Mono', monospace" },
    orientation: 'h',
    x: 0, y: 1.14,
  },
  hovermode: 'x unified',
  hoverlabel: {
    bgcolor:     '#0F0D10',
    bordercolor: 'rgba(204,136,34,0.4)',
    font:        { family: "'Space Mono', monospace", size: 10, color: '#DDD4C8' },
  },
};

const CFG = {
  displayModeBar: false,
  responsive:     true,
  scrollZoom:     false,
};

// ── Entry ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const r = await fetch('./solar_data.json');
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    DATA = await r.json();

    applyKPIs(DATA.meta.kpis);
    populateAnnualTable();
    populateModelTable();

    renderLegend5Year();
    renderChart5Year();
    renderChart7Day();
    renderHeatmap();
    renderModelChart();

    buildYearPicker();
    wireSeasonPicker();
    initScrollFade();

    // Generated timestamp
    if (DATA.meta.generated_at) {
      const d  = new Date(DATA.meta.generated_at);
      const ts = d.toUTCString();
      const el = document.getElementById('sidebar-generated');
      if (el) el.textContent = `Generated ${ts}`;
      const fe = document.getElementById('footer-gen');
      if (fe) fe.textContent = `Generated: ${ts}`;
    }

    // Peak date
    const peakLbl = document.getElementById('ksi-peak-lbl');
    if (peakLbl && DATA.meta.kpis.peak_daily_date) {
      peakLbl.textContent = `Peak — ${DATA.meta.kpis.peak_daily_date}`;
    }

    // Update sidebar KPI values from JSON
    updateCounter('skpi-annual', DATA.meta.kpis.annual_avg_kwh, 0);
    updateCounter('skpi-r2',     DATA.meta.kpis.lstm_accuracy_pct,  2, '%');
    updateCounter('skpi-rmse',   61.63, 2);
    updateCounter('skpi-total',  DATA.meta.kpis.five_year_total_kwh, 0);

    // Update main strip from JSON
    setTextNum('ksi-annual', DATA.meta.kpis.annual_avg_kwh, 0);
    setTextNum('ksi-total',  DATA.meta.kpis.five_year_total_kwh, 0);
    setTextNum('ksi-peak',   DATA.meta.kpis.peak_daily_kwh, 2);

    // Sidebar R² sub-label
    const sr2 = document.querySelector('#skpi-r2 .skpi-lbl');
    if (sr2 && DATA.meta.lstm_r2_hourly) {
      sr2.textContent = `LSTM R² · Hourly: ${DATA.meta.lstm_r2_hourly.toFixed(4)}`;
    }

    // Hide loader
    const loader = document.getElementById('loader');
    loader.style.opacity = '0';
    setTimeout(() => loader.remove(), 500);

    // Activate nav highlighting
    initNavHighlight();

  } catch (err) {
    const loader = document.getElementById('loader');
    loader.innerHTML = `
      <div style="text-align:center;max-width:440px;padding:40px;">
        <div style="font-family:'Space Mono',monospace;font-size:11px;letter-spacing:.1em;color:#CC8822;margin-bottom:14px;">DATA ERROR</div>
        <p style="color:#8A7F74;font-size:13px;line-height:1.7;margin-bottom:12px;">
          Could not load <code>solar_data.json</code>.<br>
          Run via local HTTP server to bypass CORS:
        </p>
        <code style="display:block;padding:10px 16px;background:rgba(255,255,255,0.04);border:1px solid rgba(204,136,34,.2);border-radius:2px;font-size:11px;color:#DDD4C8;letter-spacing:.02em;">
          python -m http.server 8000
        </code>
        <p style="color:#4A4440;font-size:10px;margin-top:14px;">${err.message}</p>
      </div>`;
  }
});

// ── Apply KPIs ────────────────────────────────────────────────────────────────
function applyKPIs(kpis) {
  // nothing extra — handled inline above
}

function setTextNum(id, val, dec) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = dec > 0
    ? Number(val).toFixed(dec)
    : Math.round(val).toLocaleString();
}

function updateCounter(parentId, target, dec, suffix = '') {
  const el = document.querySelector(`#${parentId} .skpi-val`);
  if (!el) return;
  const duration = 1200;
  const start    = performance.now();
  function tick(now) {
    const p = Math.min((now - start) / duration, 1);
    const e = 1 - Math.pow(1 - p, 3);
    const v = target * e;
    el.textContent = (dec > 0
      ? v.toFixed(dec)
      : Math.round(v).toLocaleString()
    ) + suffix;
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ── Scroll fade ───────────────────────────────────────────────────────────────
function initScrollFade() {
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
    });
  }, { threshold: 0.06 });
  document.querySelectorAll('.fade-in').forEach(el => io.observe(el));
}

// ── Active nav highlighting on scroll ─────────────────────────────────────────
function initNavHighlight() {
  const sections = ['abstract', 'methodology', 'forecast', 'analysis', 'models'];
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        document.querySelectorAll('.snav-link').forEach(a => a.classList.remove('snav-active'));
        const link = document.querySelector(`.snav-link[data-section="${e.target.id}"]`);
        if (link) link.classList.add('snav-active');
      }
    });
  }, { threshold: 0.3 });
  sections.forEach(id => {
    const el = document.getElementById(id);
    if (el) io.observe(el);
  });
}

// ── Annual Table ──────────────────────────────────────────────────────────────
function populateAnnualTable() {
  const tbody   = document.getElementById('annual-tbody');
  if (!tbody) return;

  const daily   = DATA.daily   || [];
  const monthly = DATA.monthly_avg || [];
  const years   = [2025, 2026, 2027, 2028, 2029];

  tbody.innerHTML = years.map(yr => {
    const dayRows = daily.filter(d => d.year === yr);

    const total = dayRows.reduce((s, d) => s + d.yield_kwh, 0);
    const avg   = dayRows.length ? total / dayRows.length : 0;

    const peak  = dayRows.length
      ? dayRows.reduce((b, d) => d.yield_kwh > b.yield_kwh ? d : b)
      : null;

    // Monsoon avg (Jun–Aug)
    const mrows  = monthly.filter(m => m.year === yr && m.month >= 6 && m.month <= 8);
    const mAvg   = mrows.length
      ? mrows.reduce((s, m) => s + m.avg_daily_kwh, 0) / mrows.length
      : 0;

    const dot = `<span class="td-yr-dot" style="background:${YEAR_COLORS[yr]};"></span>`;

    return `<tr>
      <td>${dot}${yr}</td>
      <td>${Math.round(total).toLocaleString()}</td>
      <td>${avg.toFixed(2)}</td>
      <td>${peak ? peak.yield_kwh.toFixed(2) + ' <small style="color:var(--text-3);font-size:10px;">' + peak.date + '</small>' : '—'}</td>
      <td>${mrows.length ? mAvg.toFixed(2) : '—'}</td>
    </tr>`;
  }).join('');
}

// ── Model Table ───────────────────────────────────────────────────────────────
function populateModelTable() {
  const tbody   = document.getElementById('model-tbody');
  if (!tbody) return;

  const metrics = DATA.model_metrics;
  const bestR2  = Math.max(...Object.values(metrics).map(m => m.r2));

  tbody.innerHTML = Object.entries(metrics).map(([name, m]) => {
    const isBest = m.r2 === bestR2;
    const mins   = Math.floor(m.train_time_sec / 60);
    const secs   = Math.round(m.train_time_sec % 60);

    return `<tr>
      <td>${name}</td>
      <td>${(m.r2 * 100).toFixed(2)}%</td>
      <td>${m.rmse !== undefined ? m.rmse.toFixed(1) + ' W/m²' : '—'}</td>
      <td>${mins}m ${secs.toString().padStart(2,'0')}s</td>
      <td>${isBest ? '<span class="td-badge">★ Selected</span>' : '—'}</td>
    </tr>`;
  }).join('');
}

// ── Legend ────────────────────────────────────────────────────────────────────
function renderLegend5Year() {
  const el = document.getElementById('legend-5year');
  el.innerHTML = [
    ...Object.entries(YEAR_COLORS).map(([yr, col]) =>
      `<div class="legend-item">
        <div class="legend-dot" style="background:${col};"></div>${yr}
      </div>`),
    `<div class="legend-item">
      <div class="legend-line" style="color:${CLEARSKY_COL};"></div>30-day MA
    </div>`,
  ].join('');
}

// ── 5-Year Chart ──────────────────────────────────────────────────────────────
function renderChart5Year() {
  const daily = DATA.daily;

  const traces = Object.entries(YEAR_COLORS).map(([yr, color]) => {
    const rows = daily.filter(d => String(d.year) === yr);
    return {
      x:    rows.map(d => d.date),
      y:    rows.map(d => d.yield_kwh),
      name: yr,
      type: 'scatter', mode: 'lines',
      line: { color, width: 1.2 },
      opacity: 0.88,
      hovertemplate: `<b>${yr}</b> · %{x}<br>GHI Yield: %{y:.2f} kWh/m²<extra></extra>`,
    };
  });

  // 30-day centred rolling average
  const allDates  = daily.map(d => d.date);
  const allValues = daily.map(d => d.yield_kwh);
  const rolling   = allValues.map((_, i) => {
    const s = Math.max(0, i - 15);
    const e = Math.min(allValues.length - 1, i + 15);
    const sl = allValues.slice(s, e + 1);
    return sl.reduce((a, b) => a + b, 0) / sl.length;
  });

  traces.push({
    x:    allDates,
    y:    rolling,
    name: '30-day MA',
    type: 'scatter', mode: 'lines',
    line: { color: CLEARSKY_COL, width: 2, dash: 'dot' },
    hovertemplate: 'MA: %{y:.2f} kWh/m²<extra></extra>',
  });

  Plotly.newPlot('chart-5year', traces, {
    ...BASE,
    margin: { t: 8, b: 52, l: 60, r: 12 },
    yaxis: {
      ...BASE.yaxis,
      title: { text: 'kWh / m² / day', font: { size: 10, color: '#4A4440' }, standoff: 10 },
    },
    xaxis: {
      ...BASE.xaxis,
      type:       'date',
      tickformat: '%b %Y',
      dtick:      'M3',
    },
    legend: { ...BASE.legend, x: 0, y: 1.16 },
  }, CFG);
}

// ── Year Picker ───────────────────────────────────────────────────────────────
function buildYearPicker() {
  const row   = document.getElementById('year-picker-row');
  const label = row.querySelector('.picker-tag');
  row.innerHTML = '';
  row.appendChild(label);

  Object.entries(YEAR_COLORS).forEach(([yr]) => {
    const btn = document.createElement('button');
    btn.className   = 'pick-btn' + (yr === activeYear ? ' pick-active' : '');
    btn.textContent = yr;
    btn.dataset.year = yr;
    btn.addEventListener('click', () => {
      activeYear = yr;
      document.querySelectorAll('#year-picker-row .pick-btn').forEach(b => b.classList.remove('pick-active'));
      btn.classList.add('pick-active');
      renderChart7Day();
    });
    row.appendChild(btn);
  });
}

// ── Season Picker ─────────────────────────────────────────────────────────────
function wireSeasonPicker() {
  document.querySelectorAll('#season-picker-row .pick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeMonth = btn.dataset.month;
      document.querySelectorAll('#season-picker-row .pick-btn').forEach(b => b.classList.remove('pick-active'));
      btn.classList.add('pick-active');
      renderChart7Day();
    });
  });
}

// ── 7-Day Chart ───────────────────────────────────────────────────────────────
function renderChart7Day() {
  const key     = `${activeYear}-${activeMonth}`;
  const samples = DATA.hourly_samples[key];
  const col     = YEAR_COLORS[activeYear];

  if (!samples || !samples.length) { Plotly.purge('chart-7day'); return; }

  const SEASON = {
    '01': 'January (Dry)',
    '04': 'April (Spring)',
    '07': 'July (Monsoon)',
    '10': 'October (Post-Monsoon)',
  };

  const traces = [
    {
      x: samples.map(s => s.time),
      y: samples.map(s => s.clearsky_wm2),
      name: 'Clear-sky (pvlib)',
      type: 'scatter', mode: 'lines',
      line: { color: CLEARSKY_COL, width: 1.5, dash: 'dot' },
      opacity: 0.7,
      hovertemplate: 'Clear-sky: %{y:.0f} W/m²<extra></extra>',
    },
    {
      x: samples.map(s => s.time),
      y: samples.map(s => s.ghi_wm2),
      name: 'LSTM GHI',
      type: 'scatter', mode: 'lines',
      line: { color: col, width: 2 },
      fill: 'tozeroy',
      fillcolor: hexToRgba(col, 0.09),
      hovertemplate: 'GHI: %{y:.0f} W/m²<extra></extra>',
    },
  ];

  Plotly.react('chart-7day', traces, {
    ...BASE,
    margin: { t: 8, b: 52, l: 60, r: 8 },
    xaxis: {
      ...BASE.xaxis,
      type:       'date',
      tickformat: '%b %d',
      dtick:      24 * 3600000,
      title: {
        text:     `${SEASON[activeMonth]} ${activeYear}`,
        font:     { size: 10, color: '#4A4440' },
        standoff: 6,
      },
    },
    yaxis: {
      ...BASE.yaxis,
      title: { text: 'GHI (W / m²)', font: { size: 10, color: '#4A4440' }, standoff: 8 },
    },
    legend: { ...BASE.legend, x: 0, y: 1.18 },
  }, CFG);
}

// ── Heatmap ───────────────────────────────────────────────────────────────────
function renderHeatmap() {
  const monthly = DATA.monthly_avg;
  const years   = [2025, 2026, 2027, 2028, 2029];
  const months  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const z = years.map(yr =>
    Array.from({ length: 12 }, (_, mi) => {
      const row = monthly.find(m => m.year === yr && m.month === mi + 1);
      return row ? row.avg_daily_kwh : null;
    })
  );

  Plotly.newPlot('chart-heatmap', [{
    z, x: months, y: years.map(String),
    type: 'heatmap',
    colorscale: [
      [0,    '#0A0806'],
      [0.25, '#2C1A08'],
      [0.5,  '#7A4210'],
      [0.75, '#CC8822'],
      [1,    '#F2D280'],
    ],
    showscale: true,
    colorbar: {
      tickfont:  { color: '#4A4440', size: 9, family: "'Space Mono', monospace" },
      thickness: 10,
      len:       0.85,
      title:     { text: 'kWh/m²/d', side: 'right', font: { size: 9, color: '#4A4440' } },
    },
    hovertemplate: '<b>%{y} %{x}</b><br>Avg: %{z:.2f} kWh/m²/day<extra></extra>',
    xgap: 2, ygap: 2,
  }], {
    ...BASE,
    margin:    { t: 8, b: 40, l: 48, r: 60 },
    xaxis:     { ...BASE.xaxis, showgrid: false },
    yaxis:     { ...BASE.yaxis, showgrid: false, autorange: 'reversed' },
    hovermode: 'closest',
  }, CFG);
}

// ── Model Chart ───────────────────────────────────────────────────────────────
function renderModelChart() {
  const metrics  = DATA.model_metrics;
  const names    = Object.keys(metrics);
  const r2vals   = names.map(n => +(metrics[n].r2 * 100).toFixed(2));
  const rmse     = names.map(n => metrics[n].rmse || 0);
  const barColors = ['#5B9BD5','#5DB88A','#D4894A'];

  Plotly.newPlot('chart-models', [{
    x: r2vals, y: names,
    name: 'R² Score (%)',
    type: 'bar', orientation: 'h',
    marker: { color: barColors, opacity: 0.82 },
    text:   r2vals.map((v, i) => `RMSE: ${rmse[i].toFixed(1)} W/m²`),
    textposition: 'inside',
    insidetextanchor: 'start',
    textfont: { color: 'rgba(255,255,255,0.4)', size: 9, family: "'Space Mono',monospace" },
    hovertemplate: '<b>%{y}</b><br>R²: %{x:.2f}%<extra></extra>',
  }], {
    ...BASE,
    margin: { t: 12, b: 48, l: 100, r: 80 },
    xaxis: {
      ...BASE.xaxis,
      range: [87, 101],
      title: { text: 'R² Score (%)', font: { size: 10, color: '#4A4440' }, standoff: 8 },
    },
    yaxis: {
      ...BASE.yaxis,
      showgrid: false,
      tickfont: { size: 12, color: '#DDD4C8', family: "'Space Mono', monospace" },
    },
    bargap:     0.42,
    hovermode:  'y unified',
    showlegend: false,
    annotations: names.map((n, i) => ({
      x:         101,
      y:         n,
      text:      `${r2vals[i].toFixed(2)}%`,
      showarrow: false,
      font:      { size: 11, color: '#8A7F74', family: "'Space Mono', monospace" },
      xanchor:   'left',
    })),
  }, CFG);
}

// ── Utility ───────────────────────────────────────────────────────────────────
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
