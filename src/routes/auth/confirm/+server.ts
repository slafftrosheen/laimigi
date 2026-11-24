import { redirect, type RequestHandler } from '@sveltejs/kit';
import { safeNext } from '#lib/server/auth';

export const GET: RequestHandler = async ({ locals, url }) => {
	const token_hash = url.searchParams.get('token_hash');
	const type = url.searchParams.get('type');
	if (
		locals.supabase &&
		token_hash &&
		(type === 'email' || type === 'signup' || type === 'recovery')
	) {
		const { error } = await locals.supabase.auth.verifyOtp({ token_hash, type });
		if (!error)
			redirect(303, type === 'recovery' ? '/auth/reset' : safeNext(url.searchParams.get('next')));
	}
	redirect(303, '/auth/login?error=link_expired');
};
