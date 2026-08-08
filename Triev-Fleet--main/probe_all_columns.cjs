
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://lnajcpzodjisntxjiuxc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxuYWpjcHpvZGppc250eGppdXhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MTkyMDQsImV4cCI6MjA4NTE5NTIwNH0.12sGggcu62fbfefHqbGT0Us4zoPbJ73Ho0yjVqwbhRM';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function getColumns() {
    console.log("Querying information_schema for 'leads' table...");

    // We can't query information_schema directly via supabase-js easily unless we use an RPC or just try a raw select if allowed.
    // Standard Supabase limits access to system tables.
    // BUT we can try selecting from it.

    // Alternative: Try to just insert a dummy with a known bad column to trigger an error listing columns? No, validation stops at first error.

    // Better: We can try the 'rpc' method if we had a function, but we don't.

    // Let's try to infer from a successful insert of specific columns iteratively? NO, too slow.

    // let's try to listing columns via PostgREST resource? usually not exposed.

    // Fallback: Just try to query 'leads' with limit 0 and see if `data` has structure? 
    // No, data is empty array.

    // Let's go back to the error message hint. The first probe gave us "rider_name", "mobile_number", etc valid.
    // I entered "city" and "remarks" and it passed Schema check (hit RLS).

    // Let's probe the REMAINING suspects in one go.
    // If ANY of them fail, we know one is wrong. 
    // If they all Pass (hit RLS), we are good.

    // List of potential columns to test variants for
    const checks = [
        { name: 'client', variants: ['client', 'client_interested', 'client_name'] },
        { name: 'driving_license', variants: ['driving_license', 'license_type', 'license'] },
        { name: 'ev_type', variants: ['ev_type', 'ev_type_interested', 'interested_ev'] },
        { name: 'current_ev', variants: ['current_ev', 'current_ev_using'] },
        { name: 'location', variants: ['location', 'gps_location'] },
        { name: 'category', variants: ['category', 'lead_category'] },
        { name: 'expected_allotment_date', variants: ['expected_allotment_date', 'allotment_date'] },
        { name: 'created_by', variants: ['created_by', 'created_by_id'] }
    ];

    const basePayload = { rider_name: "Test", mobile_number: "999", status: "New" };

    for (const check of checks) {
        console.log(`\nChecking variants for ${check.name}...`);
        let found = false;
        for (const variant of check.variants) {
            const payload = { ...basePayload, [variant]: check.name === 'location' ? { lat: 0, lng: 0 } : "Test" };
            if (check.name === 'expected_allotment_date') payload[variant] = new Date().toISOString();

            const { error } = await supabase.from('leads').insert(payload);

            if (error) {
                if (error.message.includes("violates row-level security")) {
                    console.log(`[SUCCESS] Column '${variant}' EXISTS (Hit RLS)`);
                    found = true;
                    break;
                } else if (error.message.includes("Could not find import")) {
                    // Should not happen for insert
                } else if (!error.message.includes("Could not find the")) {
                    // Some other error means column likely exists but data is wrong type?
                    console.log(`[Partial Success] '${variant}' might exist. Error: ${error.message}`);
                    found = true;
                    break;
                }
            } else {
                console.log(`[SUCCESS] Column '${variant}' EXISTS (Insert Success)`);
                found = true;
                break;
            }
        }
        if (!found) console.log(`[FAILURE] All variants for ${check.name} failed.`);
    }
}

getColumns();
