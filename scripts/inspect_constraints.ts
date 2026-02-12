
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectForeignKeys() {
    // Check wallet_transactions FKs
    console.log("--- wallet_transactions FKs ---");
    const { data: wt } = await supabase
        .from('information_schema.key_column_usage')
        .select('constraint_name, table_name, column_name, foreign_table_name, foreign_column_name')
        .eq('table_name', 'wallet_transactions')
        .eq('table_schema', 'public');
    console.table(wt);

    // Check leads FKs
    console.log("--- leads FKs ---");
    const { data: leads } = await supabase
        .from('information_schema.key_column_usage')
        .select('constraint_name, table_name, column_name, foreign_table_name, foreign_column_name')
        .eq('table_name', 'leads')
        .eq('table_schema', 'public');
    console.table(leads);

    // Check requests FKs
    console.log("--- requests FKs ---");
    const { data: req } = await supabase
        .from('information_schema.key_column_usage')
        .select('constraint_name, table_name, column_name, foreign_table_name, foreign_column_name')
        .eq('table_name', 'requests')
        .eq('table_schema', 'public');
    console.table(req);
}

inspectForeignKeys();
