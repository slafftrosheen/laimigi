import { fail, redirect } from '@sveltejs/kit';
import { loginSchema } from '#lib/validation';
import { safeNext } from '#lib/server/auth';
import { readBoundedForm } from '#lib/server/http';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user) redirect(303, safeNext(url.searchParams.get('next')));
	return { next: safeNext(url.searchParams.get('next')) };
};
export const actions: Actions = {
	default: async ({ request, locals, url }) => {
		if (!locals.supabase) return fail(503, { error: 'not_configured' });
		const form = await readBoundedForm(request, 8_000);
		const parsed = loginSchema.safeParse(Object.fromEntries(form));
		if (!parsed.success) return fail(400, { error: 'invalid_input' });
		const { error } = await locals.supabase.auth.signInWithPassword(parsed.data);
		if (error) return fail(400, { error: 'invalid_credentials' });
		redirect(303, safeNext(String(form.get('next') ?? url.searchParams.get('next') ?? '')));
	}
};
