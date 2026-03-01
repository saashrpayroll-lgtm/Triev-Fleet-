import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function checkCollections() {
    const { data: cols, error } = await supabase
        .from('daily_collections')
        .select('*')
        .order('date', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('--- RECENT DAILY COLLECTIONS ---');
    console.log(cols);

    // Also fetch raw wallet ledger to see what transaction_date looks like
    const { data: wl } = await supabase
        .from('wallet_ledger')
        .select('id, amount, transaction_type, transaction_date, created_at')
        .in('transaction_type', ['DAILY_COLLECTION', 'FTD_COLLECTION', 'RENT_COLLECTION'])
        .order('created_at', { ascending: false })
        .limit(5);

    console.log('\n--- RECENT WALLET LEDGER ENTRIES ---');
    console.log(wl);
}

checkCollections();
