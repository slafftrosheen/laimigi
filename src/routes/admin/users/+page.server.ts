import { error, fail } from '@sveltejs/kit';
import { z } from 'zod';
import { requireRoot } from '#lib/server/auth';
import { getServiceClient, isServiceConfigured } from '#lib/server/supabase';
import { readBoundedForm } from '#lib/server/http';
import { APP_ROLES, type AppRole } from '#lib/types';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { supabase } = requireRoot(event);
	if (!isServiceConfigured()) error(503, 'not_configured');
	const requestedPage = Number(event.url.searchParams.get('page') ?? '1');
	const page =
		Number.isInteger(requestedPage) && requestedPage > 0 && requestedPage < 100_000
			? requestedPage
			: 1;
	const { data, error: listError } = await getServiceClient().auth.admin.listUsers({
		page,
		perPage: 50
	});
	if (listError) error(503, 'database_unavailable');
	const { data: roles, error: rolesError } = await supabase
		.from('user_roles')
		.select('user_id,role')
		.in(
			'user_id',
			data.users.map((user) => user.id)
		);
	if (rolesError) error(503, 'database_unavailable');
	const byId = new Map(
		((roles as { user_id: string; role: AppRole }[]) ?? []).map((row) => [row.user_id, row.role])
	);
	return {
		users: data.users.map((user) => ({
			id: user.id,
			email: user.email ?? '',
			role: byId.get(user.id) ?? 'parent',
			created_at: user.created_at
		})),
		page,
		hasNext: data.users.length === 50
	};
};
export const actions: Actions = {
	default: async (event) => {
		const { supabase } = requireRoot(event);
		const parsed = z
			.object({ user_id: z.uuid(), role: z.enum(APP_ROLES) })
			.safeParse(Object.fromEntries(await readBoundedForm(event.request, 4_000)));
		if (!parsed.success) return fail(400, { error: 'invalid_input' });
		const { error: mutationError } = await supabase.rpc('set_user_role', {
			p_user_id: parsed.data.user_id,
			p_role: parsed.data.role
		});
		if (mutationError) return fail(400, { error: 'role_update_failed' });
		return { success: true, message: 'role_updated' };
	}
};
