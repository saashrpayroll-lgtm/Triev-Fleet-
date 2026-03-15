const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: rms, error: rmErr } = await supabase.from('users').select('id, full_name, user_id, role').eq('role', 'reportingManager');
  if (rmErr) console.error("RM Error:", rmErr);
  
  const { data: tls, error: tlErr } = await supabase.from('users').select('id, full_name, role, reporting_manager').eq('role', 'teamLeader');
  if (tlErr) console.error("TL Error:", tlErr);
  
  console.log("=== REPORTING MANAGERS ===");
  console.table(rms || []);
  
  console.log("\n=== TEAM LEADERS ===");
  console.table(tls || []);
}

check();
