
const { createClient } = require('@supabase/supabase-js');

// Load from .env manually or hardcode for this check
const SUPABASE_URL = 'https://lnajcpzodjisntxjiuxc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxuYWpjcHpvZGppc250eGppdXhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MTkyMDQsImV4cCI6MjA4NTE5NTIwNH0.12sGggcu62fbfefHqbGT0Us4zoPbJ73Ho0yjVqwbhRM';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspectSchema() {
    console.log("Fetching one lead to inspect schema...");
    const { data, error } = await supabase.from('leads').select('*').limit(1);

    if (error) {
        console.error("Error fetching leads:", error);
        return;
    }

    if (data && data.length > 0) {
        console.log("Schema Keys:", Object.keys(data[0]));
    } else {
        console.log("No leads found. Attempting Insert to probe schema...");

        // Try inserting with verified columns + testing remarks
        const testPayload = {
            rider_name: "Test Rider",
            mobile_number: "+919999999999",
            status: "New",
            // Testing remarks
            remarks: "Test Remarks",
            // Testing city
            city: "Test City"
        };

        console.log("Attempting insert with remarks, city...");
        const { error: insertError } = await supabase.from('leads').insert(testPayload);

        if (insertError) {
            console.error("Insert Error:", insertError);
            if (insertError.message.includes("remarks")) {
                console.log("remarks failed. Trying 'notes' again?");
            }
            if (insertError.message.includes("city")) {
                console.log("city failed. Trying 'location'?");
            }
        } else {
            console.log("Insert Success! Keys found: rider_name, mobile_number, status, remarks, city");
        }
    }
}

inspectSchema();
