import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkErrors() {
    const { data, error } = await supabase
        .from('import_history')
        .select('import_type, success_count, failure_count, errors, created_at')
        .eq('import_type', 'googleSheet')
        .order('created_at', { ascending: false })
        .limit(2);

    if (error) {
        console.error('Error fetching import history:', error);
    } else {
        console.log('Recent GoogleSheet (Rent) import errors:', JSON.stringify(data, null, 2));
    }
}

checkErrors();
