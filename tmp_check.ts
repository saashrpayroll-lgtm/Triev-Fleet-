import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function check() {
  const { data, error } = await supabase.from('users').select('*').limit(3);
  console.log("USERS:", JSON.stringify(data, null, 2));
  console.log("ERROR:", error);
}

check();
