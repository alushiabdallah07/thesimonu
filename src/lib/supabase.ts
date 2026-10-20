import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
export const supabaseConfigured = Boolean(url && key && !key.includes('COLE_AQUI'));
export const supabase = createClient(url || 'https://example.supabase.co', key || 'missing-publishable-key');
