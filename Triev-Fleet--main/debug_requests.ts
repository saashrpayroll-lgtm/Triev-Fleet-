
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ptqjqjzsoymvemykwdmc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0cWpxanpzb3ltdmVteWt3ZG1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2Mjg3MjcsImV4cCI6MjA4MzIwNDcyN30.6c5GYHxZV4SjaO0uFPz005Hs_Lktr2p0rNTY-_-X98Q';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkTables() {
    console.log('Checking "requests" table...');
    const { data: requestsData, error: requestsError } = await supabase
        .from('requests')
        .select('*', { count: 'exact', head: true });

    if (requestsError) {
        console.error('Error checking requests:', requestsError);
    } else {
        console.log('Requests table exists. Count:', requestsData);
    }

    console.log('\nChecking "leads" table...');
    const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true });

    if (leadsError) {
        console.error('Error checking leads:', leadsError);
    } else {
        console.log('Leads table exists. Count:', leadsData);
    }
}

checkTables();
