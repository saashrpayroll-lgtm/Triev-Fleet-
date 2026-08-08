
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
    console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConstraints() {
    console.log("Checking Foreign Keys referencing 'riders'...");

    const { data, error } = await supabase
        .rpc('get_foreign_keys_referencing', { table_name: 'riders' });

    if (error) {
        console.log("RPC get_foreign_keys_referencing not found or error. Trying direct SQL via RPC if enabled, or just listing likely tables.");
        console.error(error);

        // Fallback: Test delete on a dummy ID to see the error message (if we could, but we can't easily).
        // Instead, let's just list tables that likely have rider_id
        const tablesToCheck = ['wallet_transactions', 'daily_collections', 'leads', 'requests', 'attendance', 'activity_logs'];

        for (const table of tablesToCheck) {
            const { data: constraints, error: cError } = await supabase
                .from('information_schema.key_column_usage')
                .select('constraint_name, table_name, column_name')
                .eq('foreign_table_name', 'riders')
                .eq('table_name', table)
                .eq('table_schema', 'public');

            if (constraints && constraints.length > 0) {
                console.log(`Found FK in table '${table}':`, constraints);
            }
        }
    } else {
        console.table(data);
    }
}

checkConstraints();
