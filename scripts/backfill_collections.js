
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use Service Role for admin access

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase Environment Variables (URL or Service Key)');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function backfillCollections() {
    console.log('Starting Backfill of Daily Collections...');

    // 1. Fetch ALL valid credit transactions
    // Note: Depending on volume, might need pagination. Assuming manageable size for now.
    const { data: transactions, error } = await supabase
        .from('wallet_transactions')
        .select('amount, team_leader_id, timestamp, created_at')
        .eq('type', 'credit')
        .not('team_leader_id', 'is', null);

    if (error) {
        console.error('Error fetching transactions:', error);
        return;
    }

    console.log(`Found ${transactions.length} credit transactions to process.`);

    // 2. Aggregate Data in Memory
    // Map Key: `${team_leader_id}_${date_string}` -> total_amount
    const dailyTotals = new Map();

    transactions.forEach((txn) => {
        const amount = Number(txn.amount);
        if (isNaN(amount) || amount <= 0) return;

        // Use timestamp or created_at
        const dateObj = new Date(txn.timestamp || txn.created_at);
        // Format YYYY-MM-DD
        const dateKey = dateObj.toISOString().split('T')[0];
        const tlId = txn.team_leader_id;

        const mapKey = `${tlId}_${dateKey}`;
        const currentTotal = dailyTotals.get(mapKey) || 0;
        dailyTotals.set(mapKey, currentTotal + amount);
    });

    console.log(`Aggregated into ${dailyTotals.size} daily records.`);

    // 3. Upsert into daily_collections
    let successCount = 0;
    let failCount = 0;

    for (const [key, total] of dailyTotals.entries()) {
        const [team_leader_id, date] = key.split('_');

        const { error: upsertError } = await supabase
            .from('daily_collections')
            .upsert({
                team_leader_id,
                date,
                total_collection: total,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'team_leader_id, date'
            });

        if (upsertError) {
            console.error(`Failed to upsert for ${key}:`, upsertError.message);
            failCount++;
        } else {
            successCount++;
        }
    }

    console.log(`Backfill Complete. Success: ${successCount}, Failed: ${failCount}`);
}

backfillCollections();
