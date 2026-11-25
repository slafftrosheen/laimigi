import { fail, redirect } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth';
import { assertSameOrigin, readBoundedForm } from '#lib/server/http';
import { AdultReauthError, adultReturnPath, reauthenticateAdult } from '#lib/server/child-mode';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => {
	requireUser(event);
	const next = adultReturnPath(event.url.searchParams.get('next'));
	if (!event.locals.childMode) redirect(303, next);
	return { next };
};

export const actions: Actions = {
	default: async (event) => {
		assertSameOrigin(event);
		const { user, supabase } = requireUser(event);
		const form = await readBoundedForm(event.request, 4_000);
		const next = adultReturnPath(
			typeof form.get('next') === 'string' ? String(form.get('next')) : null
		);
		if (!event.locals.childMode) redirect(303, next);
		const password = form.get('password');
		if (typeof password !== 'string' || password.length < 1 || password.length > 128) {
			return fail(400, { error: 'adult_password_required' });
		}
		try {
			await reauthenticateAdult(user, supabase, password);
		} catch (caught) {
			const safe =
				caught instanceof AdultReauthError
					? caught
					: new AdultReauthError('adult_reauth_unavailable');
			return fail(safe.status, { error: safe.code });
		}
		// Only the new independently verified session is unlocked. Old JWT/refresh
		// tokens remain associated with the immutable database lock.
		event.locals.childMode = null;
		redirect(303, next);
	}
};
