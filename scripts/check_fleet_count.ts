import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lnajcpzodjisntxjiuxc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxuYWpjcHpvZGppc250eGppdXhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MTkyMDQsImV4cCI6MjA4NTE5NTIwNH0.12sGggcu62fbfefHqbGT0Us4zoPbJ73Ho0yjVqwbhRM';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
    const { data: user } = await supabase.from('users').select('id, full_name').ilike('email', 'kuldeep%').single();
    let tlId = user?.id || '151';

    console.log(`TL: ${user?.full_name} | ID: ${tlId}`);

    const { data: collections, error } = await supabase.from('daily_collections').select('*').eq('team_leader_id', tlId).eq('date', '2026-03-06');
    if (error) {
        console.error(error);
        return;
    }

    console.log("6th March collection row in DB:", JSON.stringify(collections, null, 2));

    const { data: cols } = await supabase.from('daily_collections').select('*').eq('team_leader_id', tlId).order('date', { ascending: false }).limit(5);
    console.log("Recent collection rows in DB:", JSON.stringify(cols, null, 2));
}
run();
