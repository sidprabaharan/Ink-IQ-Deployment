const required = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"]; 
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing env vars: ${missing.join(", ")}`);
  process.exit(1);
}
console.log("Env OK");






