import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/[^\x21-\x7E]/g, '');
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').replace(/[^\x21-\x7E]/g, '');

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
