// Light/dark switch for the public site. Choice is remembered per browser; with no choice the system setting applies.
const { useState } = React;
const h = React.createElement;
const KEY = 'kpi-theme';

const read = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
const apply = (t) => document.documentElement.setAttribute('data-theme', t);
const systemDark = () => !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);

export function ThemeToggle({ className }) {
  if (!window.__SITE__) return null;
  const [theme, setTheme] = useState(() => read() || (systemDark() ? 'dark' : 'light'));
  const dark = theme === 'dark';
  const toggle = () => {
    const next = dark ? 'light' : 'dark';
    setTheme(next); apply(next);
    try { localStorage.setItem(KEY, next); } catch (e) { /* storage unavailable */ }
  };
  return h('button', { type: 'button', role: 'switch', 'aria-checked': dark, className: 'theme-switch ' + (className || ''), onClick: toggle },
    h('span', { className: 'ts-track', 'aria-hidden': 'true' }, h('span', { className: 'ts-thumb' })),
    h('span', null, 'Dark mode'));
}
