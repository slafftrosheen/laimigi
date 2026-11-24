import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as privateEnv from '$app/env/private';
import * as publicEnv from '$app/env/public';

export function getPublicConfig() {
	return {
		url: publicEnv.PUBLIC_SUPABASE_URL?.trim() ?? '',
		key:
			(publicEnv.PUBLIC_SUPABASE_PUBLISHABLE_KEY || publicEnv.PUBLIC_SUPABASE_ANON_KEY)?.trim() ??
			''
	};
}
export function isConfigured(): boolean {
	const { url, key } = getPublicConfig();
	if (!url || !key) return false;
	try {
		const parsed = new URL(url);
		return (
			parsed.protocol === 'https:' ||
			(parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname))
		);
	} catch {
		return false;
	}
}
export function isServiceConfigured(): boolean {
	return (
		isConfigured() &&
		Boolean(privateEnv.SUPABASE_SECRET_KEY || privateEnv.SUPABASE_SERVICE_ROLE_KEY)
	);
}
/** Never use this client for ordinary family/content CRUD. It bypasses RLS. */
export function getServiceClient(): SupabaseClient {
	const key = privateEnv.SUPABASE_SECRET_KEY || privateEnv.SUPABASE_SERVICE_ROLE_KEY;
	if (!isConfigured() || !key) throw new Error('service_not_configured');
	return createClient(getPublicConfig().url, key, {
		auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
	});
}
