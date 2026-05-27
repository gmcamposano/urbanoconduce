import type { SupabaseClient, User } from '@supabase/supabase-js';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			supabase: SupabaseClient;
			safeGetUser(): Promise<{ user: User | null }>;
		}
		interface PageData {
			user: User | null;
			profile: {
				id: string;
				email: string;
				name: string | null;
				role: 'admin' | 'editor' | 'viewer';
			} | null;
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
