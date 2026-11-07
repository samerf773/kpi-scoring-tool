import { KPIS, SETUP, PASS, GRADE_RULES, multiplier, gradeFor, statusOf, brandStats } from './score.js';
import { has, pct, pts, gradeText, STATUS } from './fmt.js';
import { RankingPanel, Heatmap, BranchDetail, Trend } from './insights.jsx';
import { ChartsSection } from './charts.jsx';
import { AuthGate, Logo } from './auth.jsx';
import { ThemeToggle } from './theme.jsx';

const { useState, useEffect, useRef, useMemo, useCallback } = React;
const h = React.createElement;

const SEED = window.__SEED__;
const DOC = 'kpi/state2';
const LS_KEY = 'kpi-scorecard-v2';
const BRANDS = ['happy', 'extra'];

const initialData = () => ({
  active: 'oct-2026',
  periods: [{ id: 'oct-2026', label: 'Oct 2026', brands: { happy: SEED.happy, extra: SEED.extra } }],
});

/* ---------- formatting ---------- */
const inputText = (v) => (has(v) ? (v * 100).toFixed(2) : '');

function Status({ score, partial }) {
  if (!has(score) || partial) return h('span', { className: 'pill muted-pill' }, partial ? 'Incomplete' : '—');
  const s = STATUS[statusOf(score)];
  return h('span', { className: 'pill' }, h('span', { className: 'ico ' + s.cls, 'aria-hidden': 'true' }, s.icon), s.label);
}

/* ---------- inputs ---------- */
function PctInput({ value, onChange, disabled, id, label, col, warn }) {
  const [draft, setDraft] = useState(null);
  const shown = draft !== null ? draft : inputText(value);
  const onKey = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const all = Array.from(document.querySelectorAll('[data-col="' + col + '"]'));
    const i = all.indexOf(e.currentTarget);
    const next = all[(i + (e.shiftKey ? -1 : 1) + all.length) % all.length];
    if (next) { next.focus(); next.select(); }
  };
  return h('div', { className: 'pct-wrap' + (warn ? ' warn-input' : '') },
    h('input', {
      id, 'data-col': col, type: 'text', inputMode: 'decimal', autoComplete: 'off', 'aria-label': label, disabled,
      className: 'num', value: shown, placeholder: '—',
      onFocus: (e) => { setDraft(inputText(value)); e.target.select(); },
      onBlur: () => setDraft(null),
      onKeyDown: onKey,
      onChange: (e) => {
        const t = e.target.value;
        setDraft(t);
        const s = t.trim().replace(',', '.');
        if (s === '' || s === '-') return onChange(null);
        const n = Number(s);
        if (Number.isFinite(n)) onChange(n / 100);
      },
    }),
    h('span', { className: 'unit', 'aria-hidden': 'true' }, '%'));
}

/* ---------- persistence ---------- */
function usePersistence() {
  const [data, setData] = useState(initialData);
  const [status, setStatus] = useState('loading'); // loading | saved | saving | local | error | slow
  const [ready, setReady] = useState(false);
  const dbRef = useRef(null);
  const lastJson = useRef('');
  const timer = useRef(null);
  const writing = useRef(false);
  const pending = useRef(null);

  useEffect(() => {
    let unsub = null;
    let alive = true;
    let slow = null;
    const apply = (json) => {
      try {
        const d = JSON.parse(json);
        if (d && Array.isArray(d.periods) && d.periods.length) { lastJson.current = json; setData(d); }
      } catch (e) { /* keep defaults */ }
    };
    const useLocal = () => {
      try { const j = localStorage.getItem(LS_KEY); if (j) apply(j); } catch (e) { /* storage unavailable */ }
      setStatus('local'); setReady(true);
    };
    (async () => {
      let db = null;
      try { db = window.claude && (await window.claude.use('db')); } catch (e) { db = null; }
      if (!alive) return;
      if (!db) return useLocal();
      dbRef.current = db;
      slow = setTimeout(() => { if (alive) { setStatus('slow'); setReady(true); } }, 10000);
      try {
        unsub = db.doc(DOC).onSnapshot((snap) => {
          if (!alive) return;
          if (snap.metadata && snap.metadata.hasPendingWrites) return;
          if (snap.exists) {
            const j = snap.data() && snap.data().json;
            if (typeof j === 'string' && j !== lastJson.current) apply(j);
          }
          if (!(snap.metadata && snap.metadata.fromCache)) { clearTimeout(slow); setStatus('saved'); setReady(true); }
        }, () => { if (alive) { clearTimeout(slow); setStatus('error'); setReady(true); } });
      } catch (e) { clearTimeout(slow); useLocal(); }
    })();
    return () => { alive = false; if (unsub) unsub(); clearTimeout(slow); };
  }, []);

  const flush = useCallback(async () => {
    if (writing.current || pending.current === null) return;
    writing.current = true;
    const json = pending.current; pending.current = null;
    try {
      if (dbRef.current) { await dbRef.current.doc(DOC).set({ json }); lastJson.current = json; setStatus('saved'); }
      else { localStorage.setItem(LS_KEY, json); lastJson.current = json; setStatus('local'); }
    } catch (e) { setStatus('error'); }
    writing.current = false;
    if (pending.current !== null) flush();
  }, []);

  const update = useCallback((fn) => {
    setData((prev) => {
      const next = fn(prev);
      const json = JSON.stringify(next);
      pending.current = json;
      setStatus('saving');
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, 700);
      return next;
    });
  }, [flush]);

  return { data, update, status, ready };
}

const STATUS_TEXT = {
  loading: 'Loading saved data…', saving: 'Saving…', saved: 'All changes saved',
  local: 'Saved on this device only', error: 'Could not save. Changes stay on this page.',
  slow: "Can't reach saved data yet. Edits may not be kept.",
};

/* ---------- sections ---------- */
function Tile({ label, value, sub, children }) {
  return h('div', { className: 'tile' },
    h('div', { className: 'tile-label' }, label),
    h('div', { className: 'tile-value' }, value),
    sub ? h('div', { className: 'tile-sub' }, sub) : null, children);
}

function Summary({ brand, stats, stores }) {
  const n = stores.length;
  const w = SETUP[brand].kpis.ra.w;
  const raPts = stats.perKpi[0].avgPts;
  return h('section', { className: 'tiles', 'aria-label': 'Brand summary' },
    h(Tile, {
      label: 'Brand score', value: pct(stats.avg),
      sub: stats.complete === n ? 'Average of ' + n + ' branches · pass mark ' + pct(PASS, 0)
        : stats.complete + ' of ' + n + ' branches fully entered',
    }, stats.avg !== null ? h(Status, { score: stats.avg }) : null),
    h(Tile, { label: 'Branches passing', value: stats.complete ? stats.passing + ' of ' + stats.complete : '—', sub: 'At or above ' + pct(PASS, 0) }),
    h(Tile, { label: 'Receiving Audit average', value: pct(stats.raAvg), sub: stats.raCount + ' of ' + n + ' branches entered · target ' + pct(SETUP[brand].kpis.ra.t, 0) }),
    h(Tile, { label: 'Receiving Audit points', value: has(raPts) ? pts(raPts) + ' / ' + pts(w) : '—', sub: 'Average earned per branch' }));
}

function AuditTable({ brand, stores, scored, update, period, disabled }) {
  const setV = (sid, key, val) => update((d) => patchStore(d, period, brand, sid, (s) => {
    const m = { ...(s.m || {}) };
    delete m[key];
    return { ...s, v: { ...s.v, [key]: val }, m };
  }));
  const target = SETUP[brand].kpis.ra.t;
  const w = SETUP[brand].kpis.ra.w;
  return h('div', { className: 'table-scroll' },
    h('table', { className: 'grid' },
      h('caption', { className: 'sr' }, 'Receiving Audit entry by branch'),
      h('thead', null, h('tr', null,
        h('th', { scope: 'col' }, 'Branch'),
        h('th', { scope: 'col', className: 'r' }, 'Receiving Audit'),
        h('th', { scope: 'col' }, 'Grade applied'),
        h('th', { scope: 'col', className: 'r' }, 'Points'),
        h('th', { scope: 'col', className: 'r' }, 'Overall KPI'),
        h('th', { scope: 'col' }, 'Status'))),
      h('tbody', null, stores.map((s, i) => {
        const sc = scored[i];
        const v = s.v.ra;
        const m = multiplier(brand, 'ra', s);
        const bad = has(v) && (v < 0 || v > 1);
        return h('tr', { key: s.id },
          h('th', { scope: 'row', className: 'name' }, s.name),
          h('td', { className: 'r' }, h(PctInput, {
            id: 'ra-' + brand + '-' + s.id, label: s.name + ' receiving audit percent', col: 'ra-' + brand,
            value: v, onChange: (val) => setV(s.id, 'ra', val), disabled, warn: bad })),
          h('td', null,
            h('span', { className: 'tier' }, has(v) ? gradeText(m) : '\u2014'),
            has(v) && s.m && has(s.m.ra) && Math.abs(gradeFor(brand, 'ra', v) - s.m.ra) > 1e-9 ? h('div', { className: 'note-warn' }, 'From workbook. Rule gives ' + gradeText(gradeFor(brand, 'ra', v))) : null,
            bad ? h('div', { className: 'note-warn' }, 'Enter a value from 0 to 100') : null),
          h('td', { className: 'r num-cell' }, has(sc.pts.ra) ? pts(sc.pts.ra) + ' / ' + pts(w) : '—'),
          h('td', { className: 'r num-cell strong' }, sc.entered ? pct(sc.total) : '—'),
          h('td', null, h(Status, { score: sc.total, partial: !sc.complete })));
      }))));
}

function patchStore(d, period, brand, sid, fn) {
  return {
    ...d,
    periods: d.periods.map((p) => p.id !== period ? p : {
      ...p, brands: { ...p.brands, [brand]: p.brands[brand].map((s) => s.id === sid ? fn(s) : s) },
    }),
  };
}

function Breakdown({ stats }) {
  const rows = stats.perKpi.filter((r) => r.avgPts !== null).slice().sort((a, b) => b.lost - a.lost);
  if (!rows.length) return h('p', { className: 'empty' }, 'Enter KPI values to see where points are lost.');
  return h('div', { className: 'table-scroll' },
    h('table', { className: 'grid break' },
      h('caption', { className: 'sr' }, 'Average points earned per KPI, largest loss first' ),
      h('thead', null, h('tr', null,
        h('th', { scope: 'col' }, 'KPI'),
        h('th', { scope: 'col', className: 'r' }, 'Weight'),
        h('th', { scope: 'col' }, 'Average earned'),
        h('th', { scope: 'col', className: 'r' }, 'Points lost'))),
      h('tbody', null, rows.map((r) => h('tr', { key: r.key },
        h('th', { scope: 'row', className: 'name' }, r.label),
        h('td', { className: 'r num-cell' }, pts(r.weight)),
        h('td', null, h('div', { className: 'earn' },
          h('span', { className: 'earn-track' }, h('span', { className: 'earn-bar', style: { width: (r.avgPts / r.weight) * 100 + '%' } })),
          h('span', { className: 'num-cell earn-val' }, pts(r.avgPts) + ' / ' + pts(r.weight)))),
        h('td', { className: 'r num-cell strong' }, r.lost < 0.00005 ? '0.00' : '−' + pts(r.lost)))))));
}

function AllKpis({ brand, stores, scored, update, period, disabled }) {
  const others = KPIS.filter((k) => k.key !== 'ra');
  const setV = (sid, key, val) => update((d) => patchStore(d, period, brand, sid, (s) => {
    const m = { ...(s.m || {}) };
    delete m[key];
    return { ...s, v: { ...s.v, [key]: val }, m };
  }));
  return h('div', { className: 'table-scroll' },
    h('table', { className: 'grid wide' },
      h('caption', { className: 'sr' }, 'All KPI values by branch' ),
      h('thead', null, h('tr', null,
        h('th', { scope: 'col' }, 'Branch'),
        others.map((k) => h('th', { scope: 'col', key: k.key, className: 'r' },
          k.label, h('div', { className: 'th-sub' }, 'target ' + pct(SETUP[brand].kpis[k.key].t, k.key === 'dmg' || k.key === 'acc' ? 2 : 0) + ' · ' + pts(SETUP[brand].kpis[k.key].w) + ' pts'))))),
      h('tbody', null, stores.map((s, i) => h('tr', { key: s.id },
        h('th', { scope: 'row', className: 'name' }, s.name),
        others.map((k) => {
          const p = scored[i].pts[k.key];
          return h('td', { key: k.key, className: 'r' },
            h(PctInput, { id: k.key + '-' + brand + '-' + s.id, label: s.name + ' ' + k.label, col: k.key + '-' + brand, value: s.v[k.key], onChange: (val) => setV(s.id, k.key, val), disabled }),
            h('div', { className: 'cell-foot' },
              has(s.v[k.key]) ? h('span', { className: 'grade-chip' + (multiplier(brand, k.key, s) < 1 ? ' reduced' : ''), title: s.m && has(s.m[k.key]) ? 'Grade from your workbook. Change the value and the setup rule applies instead.' : 'Grade worked out from the setup rule' }, 'Grade ' + gradeText(multiplier(brand, k.key, s)) + (s.m && has(s.m[k.key]) && Math.abs(gradeFor(brand, k.key, s.v[k.key]) - s.m[k.key]) > 1e-9 ? ' \u00B7 rule ' + gradeText(gradeFor(brand, k.key, s.v[k.key])) : '')) : null,
              h('span', { className: 'num-cell pts-small' }, has(p) ? pts(p) : '—')));
        }))))));
}

function SetupTable({ brand }) {
  return h('div', { className: 'table-scroll' },
    h('table', { className: 'grid' },
      h('caption', { className: 'sr' }, SETUP[brand].label + ' targets and weights'),
      h('thead', null, h('tr', null, ['KPI', 'Target', 'Weight', 'Better when', 'Grade rule below target'].map((t, i) => h('th', { key: t, scope: 'col', className: i === 1 || i === 2 ? 'r' : '' }, t)))),
      h('tbody', null, KPIS.map((k) => {
        const c = SETUP[brand].kpis[k.key];
        return h('tr', { key: k.key },
          h('th', { scope: 'row', className: 'name' }, k.label),
          h('td', { className: 'r num-cell' }, pct(c.t, k.key === 'dmg' || k.key === 'acc' ? 2 : 1)),
          h('td', { className: 'r num-cell' }, pct(c.w, 1)),
          h('td', null, k.dir === 'high' ? 'Higher' : 'Lower'),
          h('td', null, GRADE_RULES[k.key]));
      }))));
}

/* ---------- app ---------- */
function App({ user, signOut }) {
  const { data, update, status, ready } = usePersistence();
  const [brand, setBrand] = useState('happy');
  const [sel, setSel] = useState(null);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const period = data.periods.find((p) => p.id === data.active) || data.periods[0];
  const stores = period.brands[brand];
  const stats = useMemo(() => brandStats(brand, stores), [brand, stores]);
  const disabled = !ready;
  const selId = stats.scored.some((r) => r.store.id === sel) ? sel : (stats.scored.slice().filter((r) => r.entered).sort((a, b) => a.total - b.total)[0] || stats.scored[0]).store.id;

  const createPeriod = () => {
    const label = newLabel.trim();
    if (!label) return;
    let id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'period';
    update((d) => {
      let uid = id, n = 2;
      while (d.periods.some((p) => p.id === uid)) uid = id + '-' + n++;
      const blank = (list) => list.map((s) => ({ id: s.id, name: s.name, v: Object.fromEntries(KPIS.map((k) => [k.key, null])), m: {} }));
      const src = d.periods.find((p) => p.id === d.active) || d.periods[0];
      return { active: uid, periods: [...d.periods, { id: uid, label, brands: { happy: blank(src.brands.happy), extra: blank(src.brands.extra) } }] };
    });
    setNewLabel(''); setAdding(false);
  };

  return h('div', { className: 'page' },
    h('header', { className: 'top' },
      h('div', { className: 'brandline' },
        h(Logo, { size: 44 }),
        h('div', null,
        h('h1', null, 'KPI Scoring Tool'),
        h('p', { className: 'lede' }, 'Enter each branch’s Receiving Audit and see the branch KPI score update. Targets and weights follow your Happy and Happy Extra setup sheets.'))),
      h('div', { className: 'controls' },
        h('div', { className: 'field' },
          h('label', { htmlFor: 'period' }, 'Period'),
          h('select', { id: 'period', value: period.id, onChange: (e) => update((d) => ({ ...d, active: e.target.value })) },
            data.periods.map((p) => h('option', { key: p.id, value: p.id }, p.label)))),
        adding
          ? h('div', { className: 'field inline' },
              h('label', { htmlFor: 'newp' }, 'New period name'),
              h('input', { id: 'newp', type: 'text', value: newLabel, placeholder: 'Nov 2026', onChange: (e) => setNewLabel(e.target.value), onKeyDown: (e) => { if (e.key === 'Enter') createPeriod(); } }),
              h('button', { className: 'btn primary', onClick: createPeriod, disabled: !newLabel.trim() }, 'Create'),
              h('button', { className: 'btn', onClick: () => setAdding(false) }, 'Cancel'))
          : h('button', { className: 'btn', onClick: () => setAdding(true), disabled }, 'New period'),
        h('span', { className: 'save save-' + status, role: 'status' }, STATUS_TEXT[status]),
        h(ThemeToggle, null),
        user ? h('div', { className: 'who' }, h('span', null, 'Signed in as ', h('strong', null, user)), h('button', { className: 'btn', onClick: signOut }, 'Sign out')) : null)),

    h('div', { className: 'tabs', role: 'tablist', 'aria-label': 'Brand' },
      BRANDS.map((b) => h('button', { key: b, role: 'tab', 'aria-selected': b === brand, className: 'tab' + (b === brand ? ' on' : ''), onClick: () => setBrand(b) },
        SETUP[b].label, h('span', { className: 'tab-n' }, period.brands[b].length + ' branches')))),

    h(Summary, { brand, stats, stores }),

    h('section', { className: 'card' },
      h('div', { className: 'card-head' },
        h('h2', null, 'Receiving Audit entry'),
        h('p', null, 'Type the audit result as a percentage. Press Enter to move to the next branch. Target is ' + pct(SETUP[brand].kpis.ra.t, 0) + ' for ' + pts(SETUP[brand].kpis.ra.w) + ' points. Grade rule: 85–89.9% earns 75%, 80–84.9% earns 50%, under 80% earns 25%.')),
      h(AuditTable, { brand, stores, scored: stats.scored, update, period: period.id, disabled })),

    h('section', { className: 'card' },
      h('div', { className: 'card-head' },
        h('h2', null, 'Charts'),
        h('p', null, 'Three views of the same data for ' + period.label + '. Hover for exact figures.')),
      h(ChartsSection, { brand, scored: stats.scored, period })),

    h('section', { className: 'card' },
      h('div', { className: 'card-head' },
        h('h2', null, 'Branch ranking'),
        h('p', null, 'Choose what to rank by, flip the order, hover for detail, or click a branch to open it below.')),
      h(RankingPanel, { brand, scored: stats.scored, sel: selId, onSel: setSel })),

    h('section', { className: 'card' },
      h('div', { className: 'card-head' },
        h('h2', null, 'KPI heatmap'),
        h('p', null, 'Each cell is the share of that KPI\u2019s points a branch earned, stepping from low to full as shown in the legend. Branches are ordered by overall score.')),
      h(Heatmap, { brand, scored: stats.scored, sel: selId, onSel: setSel })),

    h('section', { className: 'card' },
      h('div', { className: 'card-head' },
        h('h2', null, 'Branch detail'),
        h('p', null, 'Targets, grades and points for the selected branch against the brand average, plus a what-if for the Receiving Audit.')),
      h(BranchDetail, { key: brand + selId, brand, scored: stats.scored, stats, selId })),

    h('section', { className: 'card' },
      h('div', { className: 'card-head' },
        h('h2', null, 'Trend by period'),
        h('p', null, 'Brand score and Receiving Audit average for every period you have entered. Hover a period for its figures.')),
      h(Trend, { brand, periods: data.periods, activeId: period.id })),

    h('section', { className: 'card' },
      h('div', { className: 'card-head' },
        h('h2', null, 'Where the points are lost'),
        h('p', null, 'Average across ' + SETUP[brand].label + ' branches, largest loss first. Weights differ between Happy and Happy Extra.')),
      h(Breakdown, { stats })),

    h('details', { className: 'card' },
      h('summary', null, h('h2', { className: 'inline-h' }, 'All KPIs by branch')),
      h('p', { className: 'card-note' }, 'Edit the other seven KPIs here. The grade under each value is the one in your workbook for that branch. If it differs from the setup rule, the rule is shown beside it. Change a value and the setup rule takes over for that value.'),
      h(AllKpis, { brand, stores, scored: stats.scored, update, period: period.id, disabled })),

    h('details', { className: 'card' },
      h('summary', null, h('h2', { className: 'inline-h' }, SETUP[brand].label + ' setup: targets and weights')),
      h(SetupTable, { brand })),

    h('p', { className: 'foot' }, 'Brand score is the average of branch scores. The Executive Summary sheet instead scores the averaged KPIs, so its totals differ. October grades are copied from the workbook formulas. New periods and edited values use the Further scoring rules on the setup sheets, and where a rule leaves a gap the nearest band below applies. Fresh food wastage, FMCG damage and cost to income lose points as they rise above target, floored at zero.'));
}

ReactDOM.createRoot(document.getElementById('root')).render(h(AuthGate, null, (user, signOut) => h(App, { user, signOut })));
