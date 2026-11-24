import { fail, redirect } from '@sveltejs/kit';
import { signupSchema } from '#lib/validation';
import { readBoundedForm } from '#lib/server/http';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	if (locals.user) redirect(303, '/family');
};
export const actions: Actions = {
	default: async ({ request, locals, url }) => {
		if (!locals.supabase) return fail(503, { error: 'not_configured' });
		const parsed = signupSchema.safeParse(
			Object.fromEntries(await readBoundedForm(request, 8_000))
		);
		if (!parsed.success) return fail(400, { error: 'invalid_signup' });
		const { email, password } = parsed.data;
		const { data, error } = await locals.supabase.auth.signUp({
			email,
			password,
			options: { emailRedirectTo: `${url.origin}/auth/callback`, data: { locale: locals.locale } }
		});
		// Do not disclose whether an email already belongs to an account.
		if (error) return fail(400, { error: 'signup_failed' });
		if (data.session) redirect(303, '/family');
		return { success: true, message: 'check_email' };
	}
};
