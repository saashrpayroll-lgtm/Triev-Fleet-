import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testFetch() {
    try {
        console.log('--- Fetching recent daily_collections ---');
        const { data: dailyData, error: dailyError } = await supabase
            .from('daily_collections')
            .select('*')
            .order('date', { ascending: false })
            .limit(10);

        if (dailyError) throw dailyError;
        console.table(dailyData);

        console.log('\n--- Fetching recent wallet_ledger collections ---');
        const { data: ledgerData, error: ledgerError } = await supabase
            .from('wallet_ledger')
            .select('id, rider_id, amount, transaction_type, mode, created_at, metadata')
            .in('transaction_type', ['DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION'])
            .eq('mode', 'ADD')
            .order('created_at', { ascending: false })
            .limit(10);

        if (ledgerError) throw ledgerError;
        console.table(ledgerData);

    } catch (err) {
        console.error('Test Failed:', err);
    }
}

testFetch();
