import { error, redirect } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth';
import { assertSameOrigin } from '#lib/server/http';
import { uuid } from '#lib/validation';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	assertSameOrigin(event);
	const { supabase } = requireUser(event);
	const heroId = uuid.safeParse(event.params.heroId);
	if (!heroId.success) error(404, 'not_found');
	const { data, error: lockError } = await supabase.rpc('enter_child_mode', {
		p_child_profile_id: heroId.data
	});
	if (lockError) {
		if (lockError.code === '42501' || lockError.code === '22023')
			error(403, 'child_mode_forbidden');
		error(503, 'child_mode_unavailable');
	}
	if (data?.hero_id !== heroId.data) error(503, 'child_mode_unavailable');
	redirect(303, `/play/${heroId.data}`);
};
