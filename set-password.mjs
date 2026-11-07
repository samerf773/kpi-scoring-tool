// Usage: node set-password.mjs <username> <new password>
// Writes a salted PBKDF2 hash for the user into users.json. Passwords are never stored.
import crypto from 'crypto';
import fs from 'fs';
const [, , user, password] = process.argv;
if (!user || !password) { console.error('Usage: node set-password.mjs <username> <new password>'); process.exit(1); }
const file = 'users.json';
const users = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
const salt = crypto.randomBytes(16).toString('hex');
const iterations = 210000;
users[user.toLowerCase()] = { salt, iterations, hash: crypto.pbkdf2Sync(password, Buffer.from(salt, 'hex'), iterations, 32, 'sha256').toString('hex') };
fs.writeFileSync(file, JSON.stringify(users, null, 2) + '\n');
console.log('Updated', user.toLowerCase());
