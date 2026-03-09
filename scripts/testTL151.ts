import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import { format, eachDayOfInterval, startOfMonth } from 'date-fns';
export const getValidHistoricalDate = (dateRaw: string | null | undefined, fallbackDate?: string | null): string | null => {
    if (!dateRaw) return fallbackDate ? getValidHistoricalDate(fallbackDate) : null;

    try {
        const d = new Date(dateRaw);
        if (isNaN(d.getTime())) return fallbackDate ? getValidHistoricalDate(fallbackDate) : null;

        let istStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
        const todayIst = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

        // If date is in the future, it's likely an inverted DD/MM to MM/DD bug from import
        if (istStr > todayIst) {
            const [y, m, day] = istStr.split('-');
            // Swap month and day to fix the MM/DD vs DD/MM issue
            const fixedDate = `${y}-${day}-${m}`;
            // Verify fixed date is not still in the future
            if (fixedDate <= todayIst) {
                istStr = fixedDate;
            } else {
                // If still future, fallback
                istStr = todayIst;
            }
        }
        return istStr;
    } catch {
        return fallbackDate ? getValidHistoricalDate(fallbackDate) : null;
    }
};

const envContent = fs.readFileSync('.env.local', 'utf-8');
const env: Record<string, string> = {};
envContent.split('\n').forEach(line => {
    const [key, ...rest] = line.split('=');
    if (key && rest.length) env[key.trim()] = rest.join('=').trim();
});

const supabaseUrl = env['VITE_SUPABASE_URL'] || '';
const supabaseKey = env['VITE_SUPABASE_ANON_KEY'] || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const tlId = '151';

    // Fetch all riders for this TL
    const { data: riders, error } = await supabase
        .from('riders')
        .select('id, full_name, status, allotment_date, created_at, inactivated_at, updated_at')
        .eq('team_leader_id', tlId);

    if (error) {
        console.error(error);
        return;
    }

    console.log(`Total riders fetched: ${riders?.length}`);

    const rangeStart = startOfMonth(new Date());
    const rangeEnd = new Date();
    const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd }).reverse();

    days.forEach(day => {
        const ds = format(day, 'yyyy-MM-dd');

        let dayAllotments = 0;
        let daySubmissions = 0;
        let activeOnDay = 0;

        riders?.forEach(r => {
            const adIst = getValidHistoricalDate(r.allotment_date, r.created_at);
            if (adIst && adIst === ds) dayAllotments++;

            if (r.status === 'inactive' || r.status === 'deleted') {
                const iat: string | null = r.inactivated_at;
                const uat: string | null = r.updated_at;
                const inactDate = iat ? getValidHistoricalDate(iat) : (uat ? getValidHistoricalDate(uat) : null);
                if (inactDate === ds) daySubmissions++;
            }

            // Active on Day
            const adIstActive = getValidHistoricalDate(r.allotment_date, r.created_at);
            if (!adIstActive || adIstActive > ds) return;

            if (r.status === 'active') {
                activeOnDay++;
                return;
            }

            const iat: string | null = r.inactivated_at;
            const uat: string | null = r.updated_at;
            const inactDate = iat ? getValidHistoricalDate(iat) : (uat ? getValidHistoricalDate(uat) : null);
            if (inactDate && inactDate >= ds) {
                activeOnDay++;
            }
        });

        console.log(`Date: ${ds} | F: ${activeOnDay} | A: ${dayAllotments} | S: ${daySubmissions} | Net: ${dayAllotments - daySubmissions}`);
    });
}

check();
