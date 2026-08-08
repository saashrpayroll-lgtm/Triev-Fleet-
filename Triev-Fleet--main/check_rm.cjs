require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    const { data: tls } = await supabase.from('users').select('full_name, reporting_manager').eq('role', 'teamLeader');
    const { data: rms } = await supabase.from('users').select('full_name').eq('role', 'reportingManager');
    
    console.log("Team Leaders:");
    console.table(tls);
    
    console.log("\nReporting Managers:");
    console.table(rms);
}

check().catch(console.error);
