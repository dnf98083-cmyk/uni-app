import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://sskabnzjwjahmdghbmro.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNza2Fibnpqd2phaG1kZ2hibXJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMDQzNjUsImV4cCI6MjA4ODc4MDM2NX0.CDCiTkhMYft3LK9H3zoCmisrf-VmlgS8p9eiYZt8F80';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
