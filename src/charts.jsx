import { KPIS, SETUP, PASS, multiplier, brandStats } from './score.js';
import { has, pct, pts, gradeText } from './fmt.js';
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
  const tabs = [['composition', 'Score composition'], ['audit', 'Receiving Audit'], ['compare', 'Happy vs Happy Extra']];
  return h('div', null,
    h('div', { className: 'seg-tabs', role: 'tablist', 'aria-label': 'Chart' },
      tabs.map(([id, label]) => h('button', { key: id, role: 'tab', 'aria-selected': tab === id, className: 'seg-tab' + (tab === id ? ' on' : ''), onClick: () => setTab(id) }, label))),
    tab === 'composition' ? h(Composition, { brand, scored }) : tab === 'audit' ? h(AuditDots, { brand, scored }) : h(BrandCompare, { period, activeBrand: brand }));
}
