import { createBrowserClient } from '@supabase/ssr';
import { env } from '$env/dynamic/public';

// Fallback values prevent runtime crashes when the developer first boots the SvelteKit app
const supabaseUrl = env.PUBLIC_SUPABASE_URL && env.PUBLIC_SUPABASE_URL.startsWith('http') 
	? env.PUBLIC_SUPABASE_URL 
	: 'https://placeholder-project.supabase.co';
const supabaseKey = env.PUBLIC_SUPABASE_PUBLISHABLE_KEY && env.PUBLIC_SUPABASE_PUBLISHABLE_KEY.length > 20
	? env.PUBLIC_SUPABASE_PUBLISHABLE_KEY 
	: 'placeholder-anon-key-structure-value';

export const supabase = createBrowserClient(supabaseUrl, supabaseKey);
