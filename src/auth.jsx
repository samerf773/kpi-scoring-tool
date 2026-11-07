// Sign-in screen for the public site. The credential list holds salted PBKDF2 hashes only, never passwords.
// This is a front-end gate: it keeps casual visitors out of the interface but cannot protect data
// that ships inside the page itself.

const { useState, useEffect } = React;
const h = React.createElement;

const SESSION_KEY = 'kpi-user';
const enc = new TextEncoder();
const hexToBytes = (hex) => new Uint8Array(hex.match(/.{2}/g).map((b) => parseInt(b, 16)));
const bytesToHex = (bytes) => Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');

async function derive(password, saltHex, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: hexToBytes(saltHex), iterations }, key, 256);
  return bytesToHex(new Uint8Array(bits));
}

function sameText(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

async function verify(users, username, password) {
  const name = username.trim().toLowerCase();
  const rec = Object.prototype.hasOwnProperty.call(users, name) ? users[name] : null;
  // Always run one derivation so a wrong username and a wrong password take the same time.
  const probe = rec || { salt: '00'.repeat(16), iterations: 210000, hash: '' };
  const got = await derive(password, probe.salt, probe.iterations);
  return rec && sameText(got, rec.hash) ? name : null;
}

const readSession = () => { try { return sessionStorage.getItem(SESSION_KEY); } catch (e) { return null; } };
const writeSession = (v) => { try { if (v) sessionStorage.setItem(SESSION_KEY, v); else sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* storage unavailable */ } };

function Logo({ size }) {
  if (!window.__SITE__) return null;
  return h('img', { src: 'assets/logo.png', alt: 'Company logo', className: 'logo', style: { height: size }, onError: (e) => { e.currentTarget.style.display = 'none'; } });
}
export { Logo };

function Login({ users, onDone }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    let ok = null;
    try { ok = await verify(users, username, password); } catch (err) { setError('Sign-in needs a secure (https) page.'); setBusy(false); return; }
    await new Promise((r) => setTimeout(r, 600));
    if (ok) { writeSession(ok); onDone(ok); }
    else { setError('Incorrect username or password.'); setPassword(''); }
    setBusy(false);
  };

  return h('div', { className: 'login-wrap' },
    h('form', { className: 'login-card', onSubmit: submit },
      h(Logo, { size: 56 }),
      h('h1', { className: 'login-title' }, 'KPI Scoring Tool'),
      h('p', { className: 'login-sub' }, 'Sign in to enter and review branch KPI scores.'),
      h('div', { className: 'field' },
        h('label', { htmlFor: 'login-user' }, 'Username'),
        h('input', { id: 'login-user', type: 'text', autoComplete: 'username', autoCapitalize: 'none', spellCheck: false, value: username, onChange: (e) => setUsername(e.target.value), autoFocus: true })),
      h('div', { className: 'field' },
        h('label', { htmlFor: 'login-pass' }, 'Password'),
        h('input', { id: 'login-pass', type: 'password', autoComplete: 'current-password', value: password, onChange: (e) => setPassword(e.target.value) })),
      error ? h('p', { className: 'login-error', role: 'alert' }, error) : null,
      h('button', { className: 'btn primary login-btn', type: 'submit', disabled: busy || !username.trim() || !password }, busy ? 'Checking…' : 'Sign in')));
}

// Renders children(user, signOut). Without a credential list (the claude.ai version) it renders them directly.
export function AuthGate({ children }) {
  const users = window.__AUTH__;
  const [user, setUser] = useState(() => (users ? readSession() : null));
  useEffect(() => { if (users && user && !Object.prototype.hasOwnProperty.call(users, user)) { writeSession(null); setUser(null); } }, []);
  if (!users) return children(null, null);
  if (!user) return h(Login, { users, onDone: setUser });
  return children(user, () => { writeSession(null); setUser(null); });
}
