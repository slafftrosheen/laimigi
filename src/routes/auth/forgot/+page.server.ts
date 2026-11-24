import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { readBoundedForm } from '#lib/server/http';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ locals, request, url }) => {
		if (!locals.supabase) return fail(503, { error: 'not_configured' });
		const form = await readBoundedForm(request, 4_000);
		const email = z.email().max(254).safeParse(form.get('email'));
		if (!email.success) return fail(400, { error: 'invalid_input' });
		await locals.supabase.auth.resetPasswordForEmail(email.data, {
			redirectTo: `${url.origin}/auth/callback?next=/auth/reset`
		});
		return { success: true, message: 'reset_sent' };
	}
};
