import { KPIS, SETUP, PASS, multiplier, scoreStore, statusOf, brandStats, storesFor } from './score.js';
import { has, pct, pts, gradeText, STATUS } from './fmt.js';

const { useState } = React;
const h = React.createElement;

const wOf = (brand, key) => SETUP[brand].kpis[key].w;
const attainOf = (brand, r, key) => (has(r.pts[key]) ? r.pts[key] / wOf(r.brand || brand, key) : null);
const fmtVal = (key, v) => pct(v, key === 'acc' || key === 'dmg' ? 2 : 1);

export function Tip({ tip }) {
  if (!tip) return null;
  const left = Math.max(8, Math.min(tip.x + 14, window.innerWidth - 256));
  return h('div', { className: 'tip', style: { left, top: tip.y + 14 }, role: 'tooltip' },
    h('div', { className: 'tip-title' }, tip.title),
    tip.rows.map((r, i) => h('div', { key: i, className: 'tip-row' }, h('span', null, r[0]), h('span', { className: 'num-cell' }, r[1]))));
}

function StatusIcon({ score }) {
  const s = STATUS[statusOf(score)];
  return h('span', { className: 'ico ' + s.cls, 'aria-hidden': 'true', title: s.label }, s.icon);
}

function kpiTipRows(brand, r) {
  return KPIS.map((k) => [k.label, has(r.pts[k.key]) ? pts(r.pts[k.key]) + ' / ' + pts(wOf(r.brand || brand, k.key)) : 'not entered']);
}

/* ---------- ranking with metric and order controls ---------- */
export function RankingPanel({ brand, scored, sel, onSel }) {
  const [metric, setMetric] = useState('total');
  const [order, setOrder] = useState('desc');
  const [tip, setTip] = useState(null);
  const isTotal = metric === 'total';
  const label = isTotal ? 'Overall KPI score' : KPIS.find((k) => k.key === metric).label + ' (share of its points earned)';
  const rows = scored
    .map((r) => ({ r, val: isTotal ? (r.entered ? r.total : null) : attainOf(brand, r, metric) }))
    .filter((x) => x.val !== null)
    .sort((a, b) => (order === 'desc' ? b.val - a.val : a.val - b.val));

  const tipFor = (e, x) => {
    if (isTotal) return { x: e.clientX, y: e.clientY, title: x.r.store.name + ' · ' + pct(x.r.total), rows: kpiTipRows(brand, x.r) };
    const k = metric;
    const v = x.r.store.v[k];
    return {
      x: e.clientX, y: e.clientY, title: x.r.store.name,
      rows: [['Actual', fmtVal(k, v)], ['Target', fmtVal(k, SETUP[brand].kpis[k].t)], ['Grade applied', gradeText(multiplier(brand, k, x.r.store))],
        ['Points', pts(x.r.pts[k]) + ' / ' + pts(wOf(x.r.brand || brand, k))]],
    };
  };

  return h('div', null,
    h('div', { className: 'toolbar' },
      h('div', { className: 'field' },
        h('label', { htmlFor: 'rank-by' }, 'Rank by'),
        h('select', { id: 'rank-by', value: metric, onChange: (e) => setMetric(e.target.value) },
          h('option', { value: 'total' }, 'Overall KPI score'),
          KPIS.map((k) => h('option', { key: k.key, value: k.key }, k.label)))),
      h('button', { className: 'btn', onClick: () => setOrder(order === 'desc' ? 'asc' : 'desc') }, order === 'desc' ? 'Highest first' : 'Lowest first'),
      h('span', { className: 'toolbar-note' }, label)),
    rows.length === 0 ? h('p', { className: 'empty' }, 'Nothing entered for this measure yet.') :
      h('div', { className: 'rank', onMouseLeave: () => setTip(null) },
        h('div', { className: 'rank-head' },
          h('span', null, 'Branch'),
          h('span', { className: 'rank-axis' }, isTotal ? h('span', { className: 'pass-tag', style: { left: PASS * 100 + '%' } }, 'Pass ' + pct(PASS, 0)) : null),
          h('span', null)),
        rows.map((x) => h('div', {
          key: x.r.store.id, className: 'rank-row clickable' + (sel === x.r.store.id ? ' sel' : ''), tabIndex: 0, role: 'button', 'aria-pressed': sel === x.r.store.id,
          onClick: () => onSel(x.r.store.id),
          onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSel(x.r.store.id); } },
          onMouseMove: (e) => setTip(tipFor(e, x)),
          'aria-label': x.r.store.name + ' ' + pct(x.val),
        },
          h('span', { className: 'rank-name' }, x.r.store.name),
          h('span', { className: 'rank-track' },
            h('span', { className: 'rank-bar' + (isTotal && !x.r.complete ? ' partial' : ''), style: { width: Math.min(x.val, 1) * 100 + '%' } }),
            isTotal ? h('span', { className: 'rank-pass', style: { left: PASS * 100 + '%' } }) : null),
          h('span', { className: 'rank-val' }, pct(x.val), isTotal ? [' ', h(StatusIcon, { key: 'i', score: x.val })] : null))),
        h(Tip, { tip })));
}

/* ---------- heatmap: branches x KPIs, share of weight earned ---------- */
const BIN_LABELS = ['Under 50%', '50–74%', '75–89%', '90–99%', 'Full'];
const binOf = (a) => (a >= 0.99995 ? 4 : a >= 0.9 ? 3 : a >= 0.75 ? 2 : a >= 0.5 ? 1 : 0);

export function Heatmap({ brand, scored, sel, onSel }) {
  const [tip, setTip] = useState(null);
  const rows = scored.slice().sort((a, b) => b.total - a.total);
  return h('div', null,
    h('div', { className: 'table-scroll', onMouseLeave: () => setTip(null) },
      h('table', { className: 'heat' },
        h('caption', { className: 'sr' }, 'Share of each KPI’s points earned, by branch. Select a branch for detail.'),
        h('thead', null, h('tr', null,
          h('th', { scope: 'col' }, 'Branch'),
          KPIS.map((k) => h('th', { scope: 'col', key: k.key, className: 'hc' }, k.label.replace('Fresh Food ', 'FF ').replace('Receiving ', 'Recv. '))),
          h('th', { scope: 'col', className: 'hc' }, 'Overall'))),
        h('tbody', null, rows.map((r) => h('tr', { key: r.store.id, className: sel === r.store.id ? 'sel' : '' },
          h('th', { scope: 'row', className: 'name' }, h('button', { className: 'link', onClick: () => onSel(r.store.id), 'aria-pressed': sel === r.store.id }, r.store.name)),
          KPIS.map((k) => {
            const a = attainOf(brand, r, k.key);
            if (a === null) return h('td', { key: k.key, className: 'hc' }, h('span', { className: 'hcell empty-cell' }, '—'));
            const b = binOf(a);
            return h('td', { key: k.key, className: 'hc' },
              h('button', {
                className: 'hcell bin' + b, onClick: () => onSel(r.store.id),
                onMouseMove: (e) => setTip({
                  x: e.clientX, y: e.clientY, title: r.store.name + ' · ' + k.label,
                  rows: [['Actual', fmtVal(k.key, r.store.v[k.key])], ['Target', fmtVal(k.key, SETUP[brand].kpis[k.key].t)],
                    ['Grade applied', gradeText(multiplier(brand, k.key, r.store))], ['Points', pts(r.pts[k.key]) + ' / ' + pts(wOf(r.brand || brand, k.key))]],
                }),
                'aria-label': r.store.name + ' ' + k.label + ' ' + (a * 100).toFixed(2) + ' percent of points',
              }, (a * 100).toFixed(2)));
          }),
          h('td', { className: 'hc' }, h('span', { className: 'hover-total' }, r.entered ? pct(r.total, 0) : '—')))))),
      h(Tip, { tip })),
    h('div', { className: 'legend', 'aria-label': 'Heatmap legend' },
      h('span', { className: 'legend-title' }, 'Share of points earned'),
      BIN_LABELS.map((t, i) => h('span', { key: t, className: 'legend-item' }, h('span', { className: 'swatch bin' + i }), t))));
}

/* ---------- branch detail with what-if ---------- */
export function BranchDetail({ brand: tabBrand, scored, stats, selId }) {
  const [whatIf, setWhatIf] = useState(null);
  const r = scored.find((x) => x.store.id === selId && (tabBrand !== 'total' || true));
  if (!r) return h('p', { className: 'empty' }, 'Select a branch in the ranking or heatmap.');
  const brand = r.brand;
  const ranked = scored.filter((x) => x.complete).sort((a, b) => b.total - a.total);
  const rank = ranked.findIndex((x) => x.store.id === selId) + 1;
  const diff = r.complete && stats.avg !== null ? r.total - stats.avg : null;
  const ra = r.store.v.ra;
  const wiVal = whatIf !== null ? whatIf : has(ra) ? ra : SETUP[brand].kpis.ra.t;
  const sim = has(ra) || whatIf !== null ? scoreStore(brand, { ...r.store, v: { ...r.store.v, ra: wiVal } }) : null;
  const simDelta = sim && r.entered ? sim.total - r.total : null;
  const st = r.complete ? STATUS[statusOf(r.total)] : null;

  return h('div', { className: 'detail' },
    h('div', { className: 'detail-head' },
      h('div', null, h('h3', null, r.store.name), h('div', { className: 'detail-sub' }, SETUP[brand].label, r.complete && rank ? ' · rank ' + rank + ' of ' + ranked.length : ' · not fully entered')),
      h('div', { className: 'detail-score' },
        h('span', { className: 'big' }, r.entered ? pct(r.total) : '—'),
        st ? h('span', { className: 'pill' }, h('span', { className: 'ico ' + st.cls, 'aria-hidden': 'true' }, st.icon), st.label) : null,
        diff !== null ? h('span', { className: 'detail-sub' }, (diff >= 0 ? '+' : '−') + (Math.abs(diff) * 100).toFixed(2) + ' pts vs ' + (tabBrand === 'total' ? 'total' : 'brand') + ' average') : null)),
    h('div', { className: 'table-scroll' },
      h('table', { className: 'grid detail-table' },
        h('caption', { className: 'sr' }, r.store.name + ' KPI detail'),
        h('thead', null, h('tr', null,
          ['KPI', 'Actual', 'Target', 'Grade'].map((t, i) => h('th', { key: t, scope: 'col', className: i > 0 && i < 3 ? 'r' : '' }, t)),
          h('th', { scope: 'col' }, 'Points earned (tick = brand average)'),
          h('th', { scope: 'col', className: 'r' }, 'Lost'))),
        h('tbody', null, KPIS.map((k) => {
          const c = SETUP[brand].kpis[k.key];
          const a = attainOf(brand, r, k.key);
          const avg = stats.perKpi.find((p) => p.key === k.key);
          const avgA = avg && avg.avgAttain !== null ? avg.avgAttain : null;
          const lost = has(r.pts[k.key]) ? c.w - r.pts[k.key] : null;
          return h('tr', { key: k.key },
            h('th', { scope: 'row', className: 'name' }, k.label),
            h('td', { className: 'r num-cell' }, has(r.store.v[k.key]) ? fmtVal(k.key, r.store.v[k.key]) : '—'),
            h('td', { className: 'r num-cell muted' }, fmtVal(k.key, c.t)),
            h('td', { className: 'num-cell' }, has(r.store.v[k.key]) ? gradeText(multiplier(brand, k.key, r.store)) : '—'),
            h('td', null, h('div', { className: 'earn' },
              h('span', { className: 'earn-track' },
                a !== null ? h('span', { className: 'earn-bar', style: { width: a * 100 + '%' } }) : null,
                avgA !== null ? h('span', { className: 'avg-tick', style: { left: avgA * 100 + '%' } }) : null),
              h('span', { className: 'num-cell earn-val' }, has(r.pts[k.key]) ? pts(r.pts[k.key]) + ' / ' + pts(c.w) : '—'))),
            h('td', { className: 'r num-cell strong' }, lost === null ? '—' : lost < 0.00005 ? '0.00' : '−' + pts(lost)));
        })))),
    h('div', { className: 'whatif' },
      h('div', { className: 'whatif-head' },
        h('label', { htmlFor: 'whatif-range' }, 'What if the Receiving Audit were'),
        h('span', { className: 'whatif-val' }, (wiVal * 100).toFixed(2) + '%'),
        whatIf !== null ? h('button', { className: 'btn', onClick: () => setWhatIf(null) }, 'Reset') : null),
      h('input', { id: 'whatif-range', type: 'range', min: 60, max: 100, step: 0.5, value: wiVal * 100, onChange: (e) => setWhatIf(Number(e.target.value) / 100) }),
      h('div', { className: 'whatif-out' },
        sim ? [
          h('span', { key: 'g' }, 'Grade ' + gradeText(multiplier(brand, 'ra', { v: { ra: wiVal } }))),
          h('span', { key: 'p' }, 'Audit points ' + pts(sim.pts.ra) + ' / ' + pts(wOf(brand, 'ra'))),
          h('span', { key: 'o', className: 'strong' }, 'Overall ' + pct(sim.total) + (simDelta !== null && whatIf !== null ? ' (' + (simDelta >= 0 ? '+' : '−') + (Math.abs(simDelta) * 100).toFixed(2) + ' pts)' : '')),
        ] : h('span', null, 'Enter a Receiving Audit value to try scenarios. Nothing here changes saved data.'))));
}

/* ---------- trend across periods ---------- */
export function Trend({ brand, periods, activeId }) {
  const [tip, setTip] = useState(null);
  const [hover, setHover] = useState(null);
  const pts_ = periods.map((p) => {
    const st = brandStats(brand, storesFor(p, brand));
    return { id: p.id, label: p.label, score: st.avg, ra: st.raAvg, complete: st.complete, n: storesFor(p, brand).length };
  });
  const n = pts_.length;
  const W = 640, H = 230, ml = 44, mr = 20, mt = 14, mb = 30;
  const iw = W - ml - mr, ih = H - mt - mb;
  const vals = pts_.flatMap((p) => [p.score, p.ra]).filter((v) => v !== null);
  if (!vals.length) return h('p', { className: 'empty' }, 'No scores yet.');
  const lo = Math.max(0, Math.floor((Math.min(...vals) - 0.05) * 20) / 20);
  const X = (i) => ml + (n === 1 ? iw / 2 : (i * iw) / (n - 1));
  const Y = (v) => mt + ih - ((v - lo) / (1 - lo)) * ih;
  const ticks = [0, 1, 2, 3].map((i) => lo + ((1 - lo) * i) / 3);
  const series = [
    { key: 'score', name: 'Brand score', style: 'var(--series)', val: (p) => p.score },
    { key: 'ra', name: 'Receiving Audit average', style: 'var(--series2)', val: (p) => p.ra },
  ];
  const pathFor = (s) => {
    let d = '', pen = false;
    pts_.forEach((p, i) => { const v = s.val(p); if (v === null) { pen = false; return; } d += (pen ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1) + ' '; pen = true; });
    return d;
  };
  const showTip = (e, i) => {
    setHover(i);
    const p = pts_[i];
    setTip({ x: e.clientX, y: e.clientY, title: p.label, rows: [['Brand score', pct(p.score)], ['Receiving Audit average', pct(p.ra)], ['Branches fully entered', p.complete + ' of ' + p.n]] });
  };
  return h('div', null,
    h('div', { className: 'legend' }, series.map((s) => h('span', { key: s.key, className: 'legend-item' }, h('span', { className: 'line-swatch', style: { background: s.style } }), s.name))),
    h('svg', { className: 'trend', viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Brand score and Receiving Audit average by period', onMouseLeave: () => { setTip(null); setHover(null); } },
      ticks.map((t, i) => h('g', { key: i },
        h('line', { x1: ml, x2: W - mr, y1: Y(t), y2: Y(t), style: { stroke: 'var(--line)' } }),
        h('text', { x: ml - 8, y: Y(t) + 4, textAnchor: 'end', style: { fill: 'var(--muted)', fontSize: 11 } }, Math.round(t * 100) + '%'))),
      lo < PASS ? h('g', null,
        h('line', { x1: ml, x2: W - mr, y1: Y(PASS), y2: Y(PASS), style: { stroke: 'var(--ink2)' }, strokeDasharray: '4 4' }),
        h('text', { x: W - mr, y: Y(PASS) - 5, textAnchor: 'end', style: { fill: 'var(--ink2)', fontSize: 11 } }, 'Pass ' + pct(PASS))) : null,
      series.map((s) => h('path', { key: s.key, d: pathFor(s), fill: 'none', strokeWidth: 2, strokeLinejoin: 'round', style: { stroke: s.style } })),
      pts_.map((p, i) => h('text', { key: 'x' + i, x: X(i), y: H - 8, textAnchor: n === 1 ? 'middle' : i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle', style: { fill: p.id === activeId ? 'var(--ink)' : 'var(--muted)', fontSize: 11, fontWeight: p.id === activeId ? 650 : 400 } }, p.label)),
      series.map((s) => pts_.map((p, i) => { const v = s.val(p); return v === null ? null : h('circle', { key: s.key + i, cx: X(i), cy: Y(v), r: hover === i ? 6 : 4.5, strokeWidth: 2, style: { fill: s.style, stroke: 'var(--surface)' } }); })),
      series.map((s) => { const i = pts_.length - 1; const v = s.val(pts_[i]); return v === null ? null : h('text', { key: 'l' + s.key, x: X(i), y: Y(v) - 10, textAnchor: n === 1 ? 'middle' : 'end', style: { fill: 'var(--ink)', fontSize: 12, fontWeight: 650 } }, pct(v)); }),
      pts_.map((p, i) => h('rect', { key: 'h' + i, x: X(i) - Math.min(40, iw / (2 * Math.max(n - 1, 1))), y: mt, width: Math.min(80, iw / Math.max(n - 1, 1)), height: ih, fill: 'transparent', onMouseMove: (e) => showTip(e, i) }))),
    n === 1 ? h('p', { className: 'empty' }, 'Create a new period to see the trend build up month by month.') : null,
    h(Tip, { tip }));
}
