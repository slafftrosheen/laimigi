import * as env from '$app/env/private';
import { requireRoot } from '#lib/server/auth';
import { getServiceClient, isServiceConfigured } from '#lib/server/supabase';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { supabase } = requireRoot(event);
	const { error } = await supabase.from('user_roles').select('user_id').limit(1);
	const service = isServiceConfigured();
	let heroes: number | null = null,
		lessons: number | null = null;
	if (service) {
		const client = getServiceClient();
		const [h, l] = await Promise.all([
			client.from('child_profiles').select('id', { count: 'exact', head: true }),
			client.from('lessons').select('id', { count: 'exact', head: true })
		]);
		heroes = h.count;
		lessons = l.count;
	}
	const secret = env.AI_SETTINGS_ENCRYPTION_KEY;
	const encryption = Boolean(
		secret && /^[A-Za-z0-9+/]{43}=$/.test(secret) && Buffer.from(secret, 'base64').length === 32
	);
	return { setup: { database: !error, encryption, service }, counts: { heroes, lessons } };
};
