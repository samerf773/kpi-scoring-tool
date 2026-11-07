import { KPIS, SETUP, PASS, multiplier, brandStats, describe, regression, statusOf } from './score.js';
import { has, pct, pts, gradeText, STATUS } from './fmt.js';
import { Tip } from './insights.jsx';

const { useState } = React;
const h = React.createElement;

const wOf = (brand, key) => SETUP[brand].kpis[key].w;
const cvar = (i) => 'var(--c' + (i + 1) + ')';
const short = (n) => n.replace(/^Happy /i, '').replace(/ Happy$/i, '');

/* ---------- 1. score composition: stacked bar of points per KPI ---------- */
function Composition({ brand, scored }) {
  const [focus, setFocus] = useState(null);
  const [tip, setTip] = useState(null);
  const rows = scored.filter((r) => r.entered > 0).slice().sort((a, b) => b.total - a.total);
  if (!rows.length) return h('p', { className: 'empty' }, 'Enter KPI values to see the composition.');
  const segTip = (e, r, k) => setTip({
    x: e.clientX, y: e.clientY, title: r.store.name + ' · ' + k.label,
    rows: [['Actual', pct(r.store.v[k.key])], ['Target', pct(SETUP[brand].kpis[k.key].t)], ['Grade applied', gradeText(multiplier(brand, k.key, r.store))], ['Points', pts(r.pts[k.key]) + ' / ' + pts(wOf(brand, k.key))]],
  });
  return h('div', { onMouseLeave: () => setTip(null) },
    h('div', { className: 'legend legend-btns', role: 'group', 'aria-label': 'Highlight a KPI' },
      KPIS.map((k, i) => h('button', { key: k.key, className: 'legend-btn' + (focus === k.key ? ' on' : ''), 'aria-pressed': focus === k.key, onClick: () => setFocus(focus === k.key ? null : k.key) },
        h('span', { className: 'swatch', style: { background: cvar(i) } }), k.label))),
    h('div', { className: 'stack' },
      rows.map((r) => h('div', { key: r.store.id, className: 'stack-row' },
        h('span', { className: 'rank-name' }, r.store.name),
        h('span', { className: 'stack-track', role: 'img', 'aria-label': r.store.name + ' ' + pct(r.total) },
          KPIS.map((k, i) => has(r.pts[k.key]) ? h('span', {
            key: k.key, className: 'seg', style: { width: r.pts[k.key] * 100 + '%', background: cvar(i), opacity: focus && focus !== k.key ? 0.2 : 1 },
            onMouseMove: (e) => segTip(e, r, k),
          }) : null),
          h('span', { className: 'pass-mark', style: { left: PASS * 100 + '%' } })),
        h('span', { className: 'rank-val' }, pct(r.total)))),
      h('div', { className: 'stack-axis' }, h('span', null, ''), h('span', { className: 'stack-ticks' }, [0, 25, 50, 75, 100].map((t) => h('span', { key: t, style: { left: t + '%' } }, t))), h('span', null))),
    h('p', { className: 'chart-note' }, 'Each bar is out of 100 points. The empty part of a bar is points lost. The dashed line is the ' + pct(PASS) + ' pass mark. Click a KPI above to highlight it.'),
    h(Tip, { tip }));
}

/* ---------- 2. Receiving Audit against grade thresholds (dot plot) ---------- */
function AuditDots({ brand, scored }) {
  const [tip, setTip] = useState(null);
  const rows = scored.filter((r) => has(r.store.v.ra)).slice().sort((a, b) => b.store.v.ra - a.store.v.ra);
  if (!rows.length) return h('p', { className: 'empty' }, 'Enter Receiving Audit values to see this chart.');
  const target = SETUP[brand].kpis.ra.t;
  const minV = Math.min(...rows.map((r) => r.store.v.ra));
  const lo = Math.min(0.75, Math.floor((minV - 0.02) * 20) / 20);
  const hi = 1;
  const W = 640, ml = 130, mr = 70, mt = 38, rowH = 26, H = mt + rows.length * rowH + 28;
  const iw = W - ml - mr;
  const X = (v) => ml + ((Math.min(Math.max(v, lo), hi) - lo) / (hi - lo)) * iw;
  const zones = [
    { from: lo, to: 0.8, g: '25%' }, { from: 0.8, to: 0.85, g: '50%' }, { from: 0.85, to: target, g: '75%' }, { from: target, to: hi, g: '100%' },
  ].filter((z) => z.to > lo);
  const ticks = []; for (let t = Math.ceil(lo * 20) / 20; t <= hi + 1e-9; t += 0.05) ticks.push(t);
  return h('div', { onMouseLeave: () => setTip(null) },
    h('svg', { className: 'dots', viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Receiving Audit by branch against grade thresholds' },
      zones.map((z, i) => h('g', { key: i },
        h('rect', { x: X(Math.max(z.from, lo)), y: mt - 8, width: X(z.to) - X(Math.max(z.from, lo)), height: rows.length * rowH + 8, style: { fill: 'var(--zone' + (i + (4 - zones.length)) + ')' } }),
        h('text', { x: (X(Math.max(z.from, lo)) + X(z.to)) / 2, y: mt - 16, textAnchor: 'middle', style: { fill: 'var(--ink2)', fontSize: 11 } }, 'Grade ' + z.g))),
      ticks.map((t) => h('g', { key: t },
        h('line', { x1: X(t), x2: X(t), y1: mt - 8, y2: mt + rows.length * rowH, style: { stroke: Math.abs(t - target) < 1e-9 ? 'var(--ink2)' : 'var(--line)' }, strokeDasharray: Math.abs(t - target) < 1e-9 ? '4 4' : '0' }),
        h('text', { x: X(t), y: H - 8, textAnchor: 'middle', style: { fill: 'var(--muted)', fontSize: 11 } }, Math.round(t * 100) + '%'))),
      rows.map((r, i) => {
        const y = mt + i * rowH + rowH / 2 - 4;
        const v = r.store.v.ra;
        return h('g', { key: r.store.id, onMouseMove: (e) => setTip({ x: e.clientX, y: e.clientY, title: r.store.name, rows: [['Receiving Audit', pct(v)], ['Target', pct(target)], ['Grade applied', gradeText(multiplier(brand, 'ra', r.store))], ['Points', pts(r.pts.ra) + ' / ' + pts(wOf(brand, 'ra'))]] }) },
          h('rect', { x: 0, y: y - rowH / 2 + 4, width: W, height: rowH, fill: 'transparent' }),
          h('text', { x: ml - 10, y: y + 4, textAnchor: 'end', style: { fill: 'var(--ink)', fontSize: 12 } }, r.store.name),
          h('line', { x1: X(lo), x2: X(v), y1: y, y2: y, strokeWidth: 2, style: { stroke: 'var(--series-soft)' } }),
          h('circle', { cx: X(v), cy: y, r: 6, strokeWidth: 2, style: { fill: 'var(--series)', stroke: 'var(--surface)' } }),
          h('text', { x: X(v) + 12, y: y + 4, style: { fill: 'var(--ink)', fontSize: 12, fontWeight: 650 } }, pct(v)));
      })),
    h('p', { className: 'chart-note' }, 'Shaded bands are the grade the Receiving Audit earns: under 80% earns 25%, 80–84.99% earns 50%, 85–89.99% earns 75%, and ' + pct(target) + ' or more earns 100%.'),
    h(Tip, { tip }));
}

/* ---------- 3. Happy vs Happy Extra, share of each KPI's points earned ---------- */
function BrandCompare({ period, activeBrand }) {
  const [tip, setTip] = useState(null);
  const sts = { happy: brandStats('happy', period.brands.happy), extra: brandStats('extra', period.brands.extra) };
  const cols = KPIS.map((k) => ({ k, happy: sts.happy.perKpi.find((p) => p.key === k.key), extra: sts.extra.perKpi.find((p) => p.key === k.key) }));
  const att = (p) => (p && p.avgPts !== null ? p.avgPts / p.weight : null);
  const bar = (e, brand, k, p) => setTip({ x: e.clientX, y: e.clientY, title: SETUP[brand].label + ' · ' + k.label, rows: [['Share of points earned', pct(att(p))], ['Average points', pts(p.avgPts) + ' / ' + pts(p.weight)], ['Branches entered', String(p.n)]] });
  return h('div', { onMouseLeave: () => setTip(null) },
    h('div', { className: 'legend' },
      h('span', { className: 'legend-item' }, h('span', { className: 'swatch', style: { background: 'var(--series)' } }), 'Happy' + (sts.happy.avg !== null ? ' · brand score ' + pct(sts.happy.avg) : '')),
      h('span', { className: 'legend-item' }, h('span', { className: 'swatch', style: { background: 'var(--series2)' } }), 'Happy Extra' + (sts.extra.avg !== null ? ' · brand score ' + pct(sts.extra.avg) : ''))),
    h('div', { className: 'table-scroll' },
      h('div', { className: 'cols' },
        h('div', { className: 'cols-y' }, [100, 75, 50, 25, 0].map((t) => h('span', { key: t }, t + '%'))),
        h('div', { className: 'cols-plot' },
          cols.map((c) => h('div', { key: c.k.key, className: 'cols-group' },
            h('div', { className: 'cols-bars' },
              ['happy', 'extra'].map((b) => {
                const a = att(c[b]);
                return a === null ? h('span', { key: b, className: 'cbar-empty' }, '—') :
                  h('span', { key: b, className: 'cbar-wrap', onMouseMove: (e) => bar(e, b, c.k, c[b]) },
                    h('span', { className: 'cbar-val' }, (a * 100).toFixed(2)),
                    h('span', { className: 'cbar', style: { height: a * 100 + '%', background: b === 'happy' ? 'var(--series)' : 'var(--series2)' } }));
              })),
            h('div', { className: 'cols-label' }, c.k.label)))))),
    h('p', { className: 'chart-note' }, 'Each brand has its own weights, so the bars show the share of a KPI’s points earned rather than raw points. Hover a bar for the average points.'),
    h(Tip, { tip }));
}

export function ChartsSection({ brand, scored, period }) {
  const [tab, setTab] = useState('composition');
  const tabs = [['composition', 'Score composition'], ['audit', 'Receiving Audit'], ['spread', 'Spread by KPI'], ['scatter', 'Audit vs overall'], ['status', 'Status mix'], ['compare', 'Happy vs Happy Extra']];
  return h('div', null,
    h('div', { className: 'seg-tabs', role: 'tablist', 'aria-label': 'Chart' },
      tabs.map(([id, label]) => h('button', { key: id, role: 'tab', 'aria-selected': tab === id, className: 'seg-tab' + (tab === id ? ' on' : ''), onClick: () => setTab(id) }, label))),
    tab === 'composition' ? h(Composition, { brand, scored }) : tab === 'audit' ? h(AuditDots, { brand, scored }) : tab === 'spread' ? h(SpreadChart, { brand, scored }) : tab === 'scatter' ? h(ScatterChart, { brand, scored }) : tab === 'status' ? h(StatusMix, { scored }) : h(BrandCompare, { period, activeBrand: brand }));
}

/* ---------- extra charts and statistics ---------- */
const attainOf = (brand, r, key) => (has(r.pts[key]) ? r.pts[key] / wOf(brand, key) : null);

// Spread by KPI: every branch as a dot on the 0-100% share-of-points scale, line = median.
export function SpreadChart({ brand, scored }) {
  const [tip, setTip] = useState(null);
  const W = 700, ml = 150, mr = 26, mt = 22, rowH = 38, H = mt + KPIS.length * rowH + 28;
  const iw = W - ml - mr;
  const X = (a) => ml + a * iw;
  if (!scored.some((r) => r.entered)) return h('p', { className: 'empty' }, 'Enter KPI values to see the spread.');
  return h('div', { onMouseLeave: () => setTip(null) },
    h('svg', { className: 'dots', viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Share of points earned by every branch, for each KPI' },
      [0, 0.25, 0.5, 0.75, 1].map((t) => h('g', { key: t },
        h('line', { x1: X(t), x2: X(t), y1: mt - 8, y2: mt + KPIS.length * rowH, style: { stroke: 'var(--line)' } }),
        h('text', { x: X(t), y: H - 8, textAnchor: 'middle', style: { fill: 'var(--muted)', fontSize: 11 } }, Math.round(t * 100) + '%'))),
      KPIS.map((k, i) => {
        const cy = mt + i * rowH + rowH / 2;
        const entries = scored.map((r) => ({ r, a: attainOf(brand, r, k.key) })).filter((e) => e.a !== null);
        const buckets = {};
        entries.forEach((e) => { const b = Math.round(e.a * 200); (buckets[b] = buckets[b] || []).push(e); });
        const med = describe(entries.map((e) => e.a)).median;
        return h('g', { key: k.key },
          h('text', { x: ml - 10, y: cy + 4, textAnchor: 'end', style: { fill: 'var(--ink)', fontSize: 12 } }, k.label),
          h('line', { x1: X(0), x2: X(1), y1: cy, y2: cy, style: { stroke: 'var(--axis)' } }),
          med !== undefined ? h('line', { x1: X(med), x2: X(med), y1: cy - 15, y2: cy + 15, strokeWidth: 2.5, style: { stroke: 'var(--ink)' } }) : null,
          Object.values(buckets).map((list) => list.map((e, j) => {
            const gap = Math.min(4.5, 24 / list.length);
            return h('circle', {
              key: e.r.store.id, cx: X(e.a), cy: cy + (j - (list.length - 1) / 2) * gap, r: 4, strokeWidth: 1.5, style: { fill: 'var(--series)', stroke: 'var(--surface)', cursor: 'default' },
              onMouseMove: (ev) => setTip({ x: ev.clientX, y: ev.clientY, title: e.r.store.name + ' · ' + k.label, rows: [['Actual', pct(e.r.store.v[k.key])], ['Share of points', pct(e.a)], ['Points', pts(e.r.pts[k.key]) + ' / ' + pts(wOf(brand, k.key))]] }),
            });
          })));
      })),
    h('p', { className: 'chart-note' }, 'Each dot is a branch, placed by the share of that KPI’s points it earned. The black line is the median. Dots at the same value are stacked.'),
    h(Tip, { tip }));
}

// Receiving Audit against overall score, with the least-squares line and correlation.
export function ScatterChart({ brand, scored }) {
  const [tip, setTip] = useState(null);
  const pts_ = scored.filter((r) => r.complete && has(r.store.v.ra));
  if (pts_.length < 2) return h('p', { className: 'empty' }, 'Needs at least two fully entered branches.');
  const xs = pts_.map((r) => r.store.v.ra), ys = pts_.map((r) => r.total);
  const reg = regression(xs, ys);
  const xlo = Math.floor((Math.min(...xs) - 0.02) * 20) / 20, ylo = Math.floor((Math.min(...ys) - 0.03) * 20) / 20;
  const W = 640, H = 360, ml = 52, mr = 20, mt = 16, mb = 42;
  const iw = W - ml - mr, ih = H - mt - mb;
  const X = (v) => ml + ((v - xlo) / (1 - xlo)) * iw;
  const Y = (v) => mt + ih - ((v - ylo) / (1 - ylo)) * ih;
  const ticks = (lo) => { const out = []; const step = (1 - lo) > 0.3 ? 0.1 : 0.05; for (let t = Math.ceil(lo / step) * step; t <= 1 + 1e-9; t += step) out.push(+t.toFixed(2)); return out; };
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  return h('div', { onMouseLeave: () => setTip(null) },
    h('svg', { className: 'dots', viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Receiving Audit against overall KPI score, one dot per branch' },
      ticks(ylo).map((t) => h('g', { key: 'y' + t },
        h('line', { x1: ml, x2: W - mr, y1: Y(t), y2: Y(t), style: { stroke: 'var(--line)' } }),
        h('text', { x: ml - 8, y: Y(t) + 4, textAnchor: 'end', style: { fill: 'var(--muted)', fontSize: 11 } }, Math.round(t * 100) + '%'))),
      ticks(xlo).map((t) => h('text', { key: 'x' + t, x: X(t), y: H - 22, textAnchor: 'middle', style: { fill: 'var(--muted)', fontSize: 11 } }, Math.round(t * 100) + '%')),
      h('text', { x: ml + iw / 2, y: H - 6, textAnchor: 'middle', style: { fill: 'var(--ink2)', fontSize: 12 } }, 'Receiving Audit'),
      h('text', { x: 14, y: mt + ih / 2, textAnchor: 'middle', transform: 'rotate(-90 14 ' + (mt + ih / 2) + ')', style: { fill: 'var(--ink2)', fontSize: 12 } }, 'Overall KPI score'),
      ylo < PASS ? h('g', null,
        h('line', { x1: ml, x2: W - mr, y1: Y(PASS), y2: Y(PASS), strokeDasharray: '4 4', style: { stroke: 'var(--ink2)' } }),
        h('text', { x: W - mr - 4, y: Y(PASS) - 5, textAnchor: 'end', style: { fill: 'var(--ink2)', fontSize: 11 } }, 'Pass ' + pct(PASS))) : null,
      reg ? h('line', { x1: X(x0), x2: X(x1), y1: Y(Math.min(1, reg.intercept + reg.slope * x0)), y2: Y(Math.min(1, reg.intercept + reg.slope * x1)), strokeWidth: 2, style: { stroke: 'var(--series2)' } }) : null,
      pts_.map((r) => h('circle', {
        key: r.store.id, cx: X(r.store.v.ra), cy: Y(r.total), r: 6, strokeWidth: 2, style: { fill: 'var(--series)', stroke: 'var(--surface)' },
        onMouseMove: (ev) => setTip({ x: ev.clientX, y: ev.clientY, title: r.store.name, rows: [['Receiving Audit', pct(r.store.v.ra)], ['Overall KPI score', pct(r.total)], ['Status', STATUS[statusOf(r.total)].label]] }),
      }))),
    h('p', { className: 'chart-note' }, reg ? 'Correlation r = ' + reg.r.toFixed(2) + ' across ' + reg.n + ' branches. The orange line is the best straight-line fit. With this few branches, treat it as a rough guide.' : 'The line and correlation need at least 3 branches with different values.'),
    h(Tip, { tip }));
}

// How many branches sit in each status band, and which ones.
export function StatusMix({ scored }) {
  const done = scored.filter((r) => r.complete);
  if (!done.length) return h('p', { className: 'empty' }, 'Needs at least one fully entered branch.');
  const bands = ['pass', 'watch', 'below', 'critical'].map((k) => ({ k, s: STATUS[k], list: done.filter((r) => statusOf(r.total) === k).sort((a, b) => b.total - a.total) }));
  const ink = { pass: '#0b0b0b', watch: '#0b0b0b', below: '#0b0b0b', critical: '#ffffff' };
  const bg = { pass: 'var(--good)', watch: 'var(--warn)', below: 'var(--serious)', critical: 'var(--crit)' };
  return h('div', null,
    h('div', { className: 'mix-bar', role: 'img', 'aria-label': bands.map((b) => b.s.label + ' ' + b.list.length).join(', ') },
      bands.filter((b) => b.list.length).map((b) => h('span', { key: b.k, className: 'mix-seg', style: { flex: Math.max(b.list.length, 2.4), background: bg[b.k], color: ink[b.k] } }, b.s.icon + ' ' + b.s.label + ' · ' + b.list.length))),
    h('div', { className: 'mix-cols' }, bands.map((b) => h('div', { key: b.k, className: 'mix-col' },
      h('div', { className: 'mix-head' }, h('span', { className: 'ico ' + b.s.cls, 'aria-hidden': 'true' }, b.s.icon), ' ', b.s.label, h('span', { className: 'mix-n' }, b.list.length)),
      b.list.length ? b.list.map((r) => h('div', { key: r.store.id, className: 'mix-item' }, h('span', null, r.store.name), h('span', { className: 'num-cell' }, pct(r.total)))) : h('div', { className: 'mix-none' }, 'None')))),
    h('p', { className: 'chart-note' }, 'Pass is ' + pct(PASS) + ' or more, Watch is 80.00% to 84.99%, Below target is 60.00% to 79.99%, Critical is under 60.00%.'));
}

// Sortable per-KPI statistics across branches.
export function StatsTable({ brand, scored }) {
  const [sort, setSort] = useState({ key: null, dir: 'desc' });
  const rows = KPIS.map((k) => {
    const entries = scored.filter((r) => has(r.store.v[k.key])).map((r) => ({ name: r.store.name, v: r.store.v[k.key], a: attainOf(brand, r, k.key) }));
    const d = describe(entries.map((e) => e.v));
    return { k, d, n: entries.length, minE: entries.find((e) => e.v === d.min), maxE: entries.find((e) => e.v === d.max), meet: entries.filter((e) => e.a >= 0.99995).length };
  });
  const val = (r, key) => (key === 'meet' ? (r.n ? r.meet / r.n : -1) : r.d.n ? r.d[key] : -Infinity);
  const shown = sort.key ? rows.slice().sort((a, b) => (sort.dir === 'desc' ? val(b, sort.key) - val(a, sort.key) : val(a, sort.key) - val(b, sort.key))) : rows;
  const head = (key, label, right) => h('th', { scope: 'col', className: right ? 'r' : '', 'aria-sort': sort.key === key ? (sort.dir === 'desc' ? 'descending' : 'ascending') : 'none' },
    key ? h('button', { className: 'sort-btn', onClick: () => setSort(sort.key === key ? { key, dir: sort.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' }) }, label, sort.key === key ? (sort.dir === 'desc' ? ' ▾' : ' ▴') : '') : label);
  return h('div', { className: 'table-scroll' },
    h('table', { className: 'grid stats' },
      h('caption', { className: 'sr' }, 'KPI statistics across branches'),
      h('thead', null, h('tr', null, head(null, 'KPI'), head(null, 'Target', true), head('mean', 'Mean', true), head('median', 'Median', true), head('min', 'Lowest', true), head('max', 'Highest', true), head('sd', 'Std dev (pts)', true), head('meet', 'Earning full points', true))),
      h('tbody', null, shown.map((r) => h('tr', { key: r.k.key },
        h('th', { scope: 'row', className: 'name' }, r.k.label),
        h('td', { className: 'r num-cell muted' }, pct(SETUP[brand].kpis[r.k.key].t)),
        h('td', { className: 'r num-cell' }, r.d.n ? pct(r.d.mean) : '—'),
        h('td', { className: 'r num-cell' }, r.d.n ? pct(r.d.median) : '—'),
        h('td', { className: 'r num-cell' }, r.d.n ? [pct(r.d.min), h('div', { key: 'n', className: 'sub-name' }, r.minE && r.minE.name)] : '—'),
        h('td', { className: 'r num-cell' }, r.d.n ? [pct(r.d.max), h('div', { key: 'n', className: 'sub-name' }, r.maxE && r.maxE.name)] : '—'),
        h('td', { className: 'r num-cell' }, r.d.n ? (r.d.sd * 100).toFixed(2) : '—'),
        h('td', { className: 'r num-cell' }, r.n ? r.meet + ' of ' + r.n : '—'))))));
}
