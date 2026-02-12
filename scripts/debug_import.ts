
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env vars
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_ANON_KEY; // Use anon key for now, or service role if available in .env

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugRider(trievIdInput: string, mobileInput: string) {
    console.log(`\n--- Debugging Rider: TrievID="${trievIdInput}", Mobile="${mobileInput}" ---`);

    // 1. Check Triev ID Logic
    const numericId = trievIdInput.replace(/[^0-9]/g, '');
    console.log(`[TrievID] Numeric: "${numericId}"`);

    const { data: byExactId, error: err1 } = await supabase.from('riders').select('id, triev_id, mobile_number, wallet_balance').eq('triev_id', numericId);
    console.log(`[TrievID] Search "${numericId}": found ${byExactId?.length} records`);
    if (byExactId?.length) console.table(byExactId);

    const trievPrefix = `TRIEV${numericId}`;
    const { data: byPrefixId, error: err2 } = await supabase.from('riders').select('id, triev_id, mobile_number, wallet_balance').eq('triev_id', trievPrefix);
    console.log(`[TrievID] Search "${trievPrefix}": found ${byPrefixId?.length} records`);
    if (byPrefixId?.length) console.table(byPrefixId);


    // 2. Check Mobile Logic
    let cleanMobile = mobileInput.replace(/[^0-9]/g, '');
    if (cleanMobile.length > 10) cleanMobile = cleanMobile.slice(-10);
    console.log(`[Mobile] Clean (last 10): "${cleanMobile}"`);

    const formats = [
        cleanMobile,
        `+91${cleanMobile}`,
        `91${cleanMobile}`
    ];

    for (const fmt of formats) {
        const { data: byMobile, error: errMobile } = await supabase.from('riders').select('id, triev_id, mobile_number, wallet_balance').eq('mobile_number', fmt);
        console.log(`[Mobile] Search "${fmt}": found ${byMobile?.length} records`);
        if (byMobile?.length) console.table(byMobile);
    }

    // 3. Raw Search (to see what IS there)
    // Try LIKE search if exact failed
    const { data: likeSearch } = await supabase.from('riders').select('id, triev_id, mobile_number').ilike('mobile_number', `%${cleanMobile}%`);
    console.log(`[Wildcard] Mobile %${cleanMobile}%: found ${likeSearch?.length} records`);
    if (likeSearch?.length) console.table(likeSearch);

    const { data: idSearch } = await supabase.from('riders').select('id, triev_id, mobile_number').ilike('triev_id', `%${numericId}%`);
    console.log(`[Wildcard] TrievID %${numericId}%: found ${idSearch?.length} records`);
    if (idSearch?.length) console.table(idSearch);
}

async function run() {
    await debugRider('26325', '918979654749');
    await debugRider('26334', '917906582207');
    await debugRider('25046', '917065142010');
}

run();
