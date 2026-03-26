import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: 'c:\\Rider App\\.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL as string, process.env.VITE_SUPABASE_ANON_KEY as string);

async function check() {
    console.log("Fetching import history...");
    const { data: history, error } = await supabase
        .from('import_history')
        .select('*')
        .eq('import_type', 'googleSheet')
        .order('timestamp', { ascending: false })
        .limit(6);

    if (error) {
        console.error("Error fetching history:", error);
        return;
    }

    if (history && history.length > 0) {
        for (const h of history) {
            console.log(`\nImport Date: ${h.timestamp} | Total: ${h.total_rows} | Success: ${h.success_count} | Skipped: ${h.skipped_count} | Failed: ${h.failure_count}`);
            
            // Look for recent imports
            if (h.errors && h.errors.length > 0) {
                console.log("Errors:", JSON.stringify(h.errors, null, 2));
            }
            if (h.total_rows >= 275 && h.total_rows <= 300) {
                 if (h.skipped_details && h.skipped_details.length > 0 && h.total_rows === 293) {
                     console.log("Skipped Details Sample:", JSON.stringify(h.skipped_details.slice(0, 5), null, 2));
                 }
                 
                 // If success was 1, fetch that transaction
                 if (h.success_count === 1) {
                     const { data: txns } = await supabase
                         .from('wallet_ledger')
                         .select('*, riders(rider_name)')
                         .eq('source', 'IMPORT')
                         .gte('created_at', h.timestamp)
                         .order('created_at', { ascending: true })
                         .limit(3);
                     if (txns && txns.length > 0) {
                         console.log(`Transactions inserted at ${h.timestamp}:`);
                         txns.forEach(tx => console.log(`  - Row ID: ${tx.id} | Rider: ${tx.riders?.rider_name} | Amt: ₹${tx.amount} | Date: ${tx.transaction_date || tx.created_at} | TxnID: ${tx.external_id || 'NONE'}`));
                     } else {
                         console.log("No transactions found immediately after this import timestamp.");
                     }
                 }
            }
        }
    }
}

check();
