import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Manually parse .env.local
const envPath = path.resolve('.env.local');
let supabaseUrl = '';
let supabaseKey = '';

if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            let val = match[2].trim();
            if (val.startsWith('"') && val.endsWith('"')) {
                val = val.slice(1, -1);
            }
            if (match[1].trim() === 'VITE_SUPABASE_URL') supabaseUrl = val;
            if (match[1].trim() === 'VITE_SUPABASE_ANON_KEY') supabaseKey = val;
        }
    });
}

if (!supabaseUrl) throw new Error("Supabase URL not found");

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCollections() {
    console.log("Checking wallet ledger ADD transactions by type...");
    const { data: ledgerTypes, error: e1 } = await supabase
        .from('wallet_ledger')
        .select('transaction_type, amount, mode')
        .eq('mode', 'ADD');

    if (e1) console.error("Error reading wallet ledger", e1);

    const typeSummary: Record<string, { count: number, total: number }> = {};
    ledgerTypes?.forEach(t => {
        if (!typeSummary[t.transaction_type]) typeSummary[t.transaction_type] = { count: 0, total: 0 };
        typeSummary[t.transaction_type].count++;
        typeSummary[t.transaction_type].total += Number(t.amount);
    });
    console.log("Ledger Types:", typeSummary);

    console.log("\nChecking daily_collections table...");
    const today = new Date().toISOString().split('T')[0];
    const { data: daily, error: e2 } = await supabase
        .from('daily_collections')
        .select('team_leader_id, total_collection, date')
        .eq('date', today);

    if (e2) console.error("Error reading daily_collections", e2);
    console.log("Today's Daily Collections records:", daily?.length || 0);

    // also check if any riders have null team_leader_id
    const { count: nullTlCount } = await supabase
        .from('riders')
        .select('*', { count: 'exact', head: true })
        .is('team_leader_id', null);

    console.log("\nRiders with NULL team_leader_id:", nullTlCount);

}

checkCollections();
