import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { AppRole, Locale } from '#lib/types';

declare global {
	namespace App {
		interface Locals {
			supabase: SupabaseClient | null;
			user: User | null;
			role: AppRole | null;
			locale: Locale;
			configured: boolean;
		}
		interface PageData {
			locale: Locale;
			user: { id: string; email: string | undefined } | null;
			role: AppRole | null;
			configured: boolean;
		}
	}
}

export {};
