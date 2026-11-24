import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { requireUser } from '#lib/server/auth';
import { readBoundedForm } from '#lib/server/http';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => {
	requireUser(event);
};
export const actions: Actions = {
	default: async (event) => {
		const { supabase } = requireUser(event);
		const form = await readBoundedForm(event.request, 4_000);
		const password = z.string().min(12).max(128).safeParse(form.get('password'));
		if (!password.success) return fail(400, { error: 'invalid_input' });
		const { error } = await supabase.auth.updateUser({ password: password.data });
		if (error) return fail(400, { error: 'update_failed' });
		redirect(303, '/family');
	}
};
