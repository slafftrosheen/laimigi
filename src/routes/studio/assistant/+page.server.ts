import { requireRole } from '#lib/server/auth';
import { getServiceClient, isServiceConfigured } from '#lib/server/supabase';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireRole(event, ['teacher', 'admin', 'root_admin']);
	if (!isServiceConfigured()) return { providers: [] };
	const { data } = await getServiceClient()
		.from('ai_provider_settings')
		.select('provider,model')
		.eq('enabled', true);
	return { providers: (data ?? []) as { provider: 'openrouter' | 'openai'; model: string }[] };
};
