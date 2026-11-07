// Scoring engine. Mirrors the formulas in the workbook's "KPI Setup" and "KPI Tracker" sheets.

export const KPIS = [
  { key: 'ra', label: 'Receiving Audit', dir: 'high' },
  { key: 'acc', label: 'Receiving Accuracy', dir: 'high' },
  { key: 'ff', label: 'Fresh Food Wastage', dir: 'low' },
  { key: 'dmg', label: 'FMCG Damage', dir: 'low' },
  { key: 'sales', label: 'Sales to Target', dir: 'high' },
  { key: 'am', label: 'AM Checklist', dir: 'high' },
  { key: 'fs', label: 'Food Safety', dir: 'high' },
  { key: 'c2i', label: 'Cost to Income', dir: 'low' },
];

// Targets and weights from "KPI Setup Happy" and "KPI Setup Happy Extra".
export const SETUP = {
  happy: {
    label: 'Happy',
    kpis: {
      ra: { t: 0.9, w: 0.1 }, acc: { t: 0.9975, w: 0.075 }, ff: { t: -0.07, w: 0.125 }, dmg: { t: 0.005, w: 0.05 },
      sales: { t: 1, w: 0.2 }, am: { t: 0.85, w: 0.125 }, fs: { t: 0.87, w: 0.175 }, c2i: { t: 0.2, w: 0.15 },
    },
  },
  extra: {
    label: 'Happy Extra',
    kpis: {
      ra: { t: 0.9, w: 0.1 }, acc: { t: 0.9975, w: 0.075 }, ff: { t: -0.07, w: 0.05 }, dmg: { t: 0.005, w: 0.075 },
      sales: { t: 1, w: 0.2 }, am: { t: 0.85, w: 0.15 }, fs: { t: 0.87, w: 0.15 }, c2i: { t: 0.2, w: 0.2 },
    },
  },
};

export const PASS = 0.85;

// "Further scoring" grades from the setup sheets. At or above target a KPI earns its full grade (100%).
// Below target, each KPI steps down by the bands the setup sheet lists. Where the sheet lists no band
// for a value, the nearest band below it applies, and under the lowest listed band the lowest listed
// grade continues. KPIs with no rule (wastage, damage, cost to income) always earn 100%.
const BANDS = {
  ra: [[0.85, 0.75], [0.8, 0.5], [-Infinity, 0.25]],
  acc: [[0.95, 0.75], [-Infinity, 0.75]],
  am: [[0.8, 0.75], [0.75, 0.5], [-Infinity, 0.25]],
  fs: [[0.8, 0.75], [-Infinity, 0.75]],
  sales: [[0.97, 0.9], [0.93, 0.6], [0.9, 0.3], [0.86, 0.1], [-Infinity, 0]],
};

// Plain-language rule text shown in the setup table.
export const GRADE_RULES = {
  ra: '85–89.9% earns 75%, 80–84.9% earns 50%, under 80% earns 25%',
  acc: '95–99.7% earns 75%',
  ff: 'No rule',
  dmg: 'No rule',
  sales: '97–99% earns 90%, 93–96% earns 60%, 90–92% earns 30%, 86–90% earns 10%, under 85% earns 0',
  am: '80–85% earns 75%, 75–80% earns 50%, under 75% earns 25%',
  fs: '80–85% earns 75%',
  c2i: 'No rule',
};

const has = (x) => x !== null && x !== undefined && x !== '' && Number.isFinite(x);

export function gradeFor(brand, kpi, v) {
  if (!has(v)) return 1;
  const bands = BANDS[kpi];
  if (!bands) return 1;
  if (v >= SETUP[brand].kpis[kpi].t) return 1;
  for (const [from, g] of bands) if (v >= from) return g;
  return 1;
}

// A grade stored on the branch (taken from the workbook formulas) holds until that value is changed;
// otherwise the setup-sheet rule decides.
export function multiplier(brand, kpi, store) {
  const m = store.m && store.m[kpi];
  if (has(m)) return m;
  return gradeFor(brand, kpi, store.v[kpi]);
}

function basePct(kpi, v, t) {
  let b;
  if (kpi === 'ff' || kpi === 'c2i') b = Math.min(2 - Math.abs(v) / Math.abs(t), 1);
  else if (kpi === 'dmg') b = Math.min(2 - v / t, 1);
  else b = Math.min(v / t, 1);
  return Math.max(0, b);
}

export function pointsFor(brand, kpi, store) {
  const v = store.v[kpi];
  if (!has(v)) return null;
  const { t, w } = SETUP[brand].kpis[kpi];
  return basePct(kpi, v, t) * w * multiplier(brand, kpi, store);
}

export function scoreStore(brand, store) {
  const pts = {};
  let total = 0;
  let entered = 0;
  for (const k of KPIS) {
    const p = pointsFor(brand, k.key, store);
    pts[k.key] = p;
    if (p !== null) { total += p; entered += 1; }
  }
  return { pts, total, entered, complete: entered === KPIS.length };
}

export function statusOf(score) {
  if (score >= PASS) return 'pass';
  if (score >= 0.8) return 'watch';
  if (score >= 0.6) return 'below';
  return 'critical';
}

export function brandStats(brand, stores) {
  const scored = stores.map((s) => ({ store: s, ...scoreStore(brand, s) }));
  const complete = scored.filter((s) => s.complete);
  const avg = complete.length ? complete.reduce((a, s) => a + s.total, 0) / complete.length : null;
  const passing = complete.filter((s) => s.total >= PASS).length;
  const perKpi = KPIS.map((k) => {
    const vals = scored.map((s) => s.pts[k.key]).filter((p) => p !== null);
    const w = SETUP[brand].kpis[k.key].w;
    const avgPts = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    return { key: k.key, label: k.label, weight: w, avgPts, n: vals.length, lost: avgPts === null ? null : w - avgPts };
  });
  const raVals = stores.map((s) => s.v.ra).filter(has);
  const raAvg = raVals.length ? raVals.reduce((a, b) => a + b, 0) / raVals.length : null;
  return { scored, complete: complete.length, avg, passing, perKpi, raAvg, raCount: raVals.length };
}
