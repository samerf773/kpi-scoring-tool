export const has = (x) => x !== null && x !== undefined && Number.isFinite(x);
export const pct = (x) => (has(x) ? (x * 100).toFixed(2) + '%' : '—');
export const pts = (x) => (has(x) ? (x * 100).toFixed(2) : '—');
export const gradeText = (m) => (m * 100).toFixed(2) + '%';
export const STATUS = {
  pass: { label: 'Pass', icon: '✓', cls: 'good' },
  watch: { label: 'Watch', icon: '▲', cls: 'warn' },
  below: { label: 'Below target', icon: '▼', cls: 'serious' },
  critical: { label: 'Critical', icon: '✕', cls: 'crit' },
};
