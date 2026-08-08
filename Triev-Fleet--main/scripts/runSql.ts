import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const sql = `
    -- Add target_amount to users table if it doesn't exist
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'target_amount') THEN
            ALTER TABLE public.users ADD COLUMN target_amount numeric(10,2) DEFAULT 0;
            RAISE NOTICE 'Added target_amount column to users table';
        ELSE
            RAISE NOTICE 'target_amount column already exists in users table';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'target_allotments') THEN
            ALTER TABLE public.users ADD COLUMN target_allotments integer DEFAULT 0;
            RAISE NOTICE 'Added target_allotments column to users table';
        ELSE
            RAISE NOTICE 'target_allotments column already exists in users table';
        END IF;
    END $$;
  `;

    // Since we can't reliably run raw SQL via the JS client without an RPC, 
    // Let's just create an RPC function or instruct the user.
    console.log("Since we don't have direct SQL access through JS client, we need to run this in Supabase SQL Editor:");
    console.log(sql);
}

run();
