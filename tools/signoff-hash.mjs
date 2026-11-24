// Make the Cyber Hub 15 sign-off verifier for a new instructor password.
// Usage: node tools/signoff-hash.mjs "the new password"
// Paste the printed SIGNOFF line over the one in src/signoff.js, rebuild and push. The password itself is
// never stored anywhere: only a salted PBKDF2 hash, which can confirm it but not reveal it.
import { pbkdf2Sync, randomBytes } from "node:crypto";
const pw = process.argv[2];
if (!pw) { console.error('Usage: node tools/signoff-hash.mjs "the new password"'); process.exit(1); }
const norm = (s) => s.normalize("NFKC").toLowerCase().replace(/[\s\-_.]+/g, "");
const salt = randomBytes(16).toString("hex"), iter = 600000;
const bits = pbkdf2Sync(norm(pw), salt, iter, 64, "sha256");
console.log(`const SIGNOFF = { salt: "${salt}", iter: ${iter}, check: "${bits.subarray(0, 32).toString("hex")}" };`);
