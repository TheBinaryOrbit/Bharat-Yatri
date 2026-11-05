// Creates (or resets) an admin portal account.
//
//   node scripts/create-admin.mjs --email you@bharatyaatri.com --name "Your Name" --password "S0meLongPass" [--role super_admin]
//
// Run from Backend3.0/ so .env is found. If the email already exists, its password, name and role
// are reset and all of its sessions are signed out.
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const { Admin } = await import('../src/models/admin.model.js');
const { ADMIN_ROLE_KEYS, ADMIN_MIN_PASSWORD_LENGTH } = await import('../src/constants/admin.constants.js');

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => {
    if (arg.startsWith('--')) pairs.push([arg.slice(2), all[i + 1]]);
    return pairs;
  }, [])
);

const email = String(args.email || '').trim().toLowerCase();
const name = String(args.name || '').trim();
const password = String(args.password || '');
const role = args.role || 'super_admin';

const problems = [];
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) problems.push('--email must be a valid email');
if (!name) problems.push('--name is required');
if (password.length < ADMIN_MIN_PASSWORD_LENGTH || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
  problems.push(`--password needs ${ADMIN_MIN_PASSWORD_LENGTH}+ characters with letters and numbers`);
}
if (!ADMIN_ROLE_KEYS.includes(role)) problems.push(`--role must be one of: ${ADMIN_ROLE_KEYS.join(', ')}`);
if (problems.length) {
  console.error(problems.map((p) => `✗ ${p}`).join('\n'));
  process.exit(1);
}

if (!process.env.MONGO_URI) {
  console.error('✗ MONGO_URI is not set');
  process.exit(1);
}

await mongoose.connect(process.env.MONGO_URI);
const passwordHash = await bcrypt.hash(password, 12);
const existing = await Admin.findOne({ email });

if (existing) {
  existing.name = name;
  existing.role = role;
  existing.isActive = true;
  existing.passwordHash = passwordHash;
  existing.tokenVersion = (existing.tokenVersion ?? 0) + 1;
  await existing.save();
  console.log(`✓ Reset admin ${email} (${role})`);
} else {
  await Admin.create({ email, name, role, passwordHash });
  console.log(`✓ Created admin ${email} (${role})`);
}

await mongoose.disconnect();
