
const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://lnajcpzodjisntxjiuxc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxuYWpjcHpvZGppc250eGppdXhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MTkyMDQsImV4cCI6MjA4NTE5NTIwNH0.12sGggcu62fbfefHqbGT0Us4zoPbJ73Ho0yjVqwbhRM';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkScore() {
    console.log("Checking for 'score' column...");
    const payload = { rider_name: "Test Score", mobile_number: "555", status: "New", score: 50 };
    const { error } = await supabase.from('leads').insert(payload);

    if (error) {
        if (error.message.includes("violates row-level security")) {
            console.log("[SUCCESS] Column 'score' EXISTS (Hit RLS)");
        } else {
            console.log("[FAILURE] Error:", error.message);
        }
    } else {
        console.log("[SUCCESS] Column 'score' EXISTS (Insert Success)");
    }
}
checkScore();
