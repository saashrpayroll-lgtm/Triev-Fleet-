import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.resolve('.env');
let supabaseUrl = '';
let supabaseKey = '';

if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            let val = match[2].trim();
            if (val.startsWith('"') && val.endsWith('"')) {
                val = val.slice(1, -1);
            }
            if (match[1].trim() === 'VITE_SUPABASE_URL') supabaseUrl = val;
            if (match[1].trim() === 'VITE_SUPABASE_ANON_KEY') supabaseKey = val;
        }
    });
}
const supabase = createClient(supabaseUrl, supabaseKey);

export const getValidHistoricalDate = (dateRaw: string | null | undefined, fallbackDate?: string | null): string | null => {
    if (!dateRaw) return fallbackDate ? getValidHistoricalDate(fallbackDate) : null;

    try {
        const d = new Date(dateRaw);
        if (isNaN(d.getTime())) return fallbackDate ? getValidHistoricalDate(fallbackDate) : null;

        let istStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
        const todayIst = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

        if (istStr > todayIst) {
            const [y, m, day] = istStr.split('-');
            const fixedDate = `${y}-${day}-${m}`;
            if (fixedDate <= todayIst) {
                istStr = fixedDate;
            } else {
                istStr = todayIst;
            }
        }
        return istStr;
    } catch {
        return fallbackDate ? getValidHistoricalDate(fallbackDate) : null;
    }
};

async function run() {
    const { data: user } = await supabase.from('users').select('id, full_name').ilike('email', 'kuldeepyadav%').single();
    let tlId = user?.id || '151';

    console.log(`TL: ${user?.full_name} | ID: ${tlId}`);

    const { data: collections } = await supabase.from('daily_collections').select('*').eq('team_leader_id', tlId).eq('date', '2026-03-06');
    console.log("6th March collection row:", collections);

    const { data: riders } = await supabase.from('riders').select('id, status, allotment_date, inactivated_at, created_at, updated_at').eq('team_leader_id', tlId);

    const ds = '2026-03-06';
    const activeOnDay = riders?.filter(r => {
        const adIst = getValidHistoricalDate(r.allotment_date, r.created_at);
        if (!adIst) return false;
        if (adIst > ds) return false;

        if (r.status === 'active') return true;

        const iat: string | null = r.inactivated_at;
        const uat: string | null = r.updated_at;
        const inactDate = iat ? getValidHistoricalDate(iat) : (uat ? getValidHistoricalDate(uat) : null);

        return inactDate ? inactDate > ds : false;
    }).length;

    console.log(`Dynamically calculated fleet for ${ds}: ${activeOnDay}`);
}
run();
