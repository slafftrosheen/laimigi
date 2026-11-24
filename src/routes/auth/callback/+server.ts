import { redirect, type RequestHandler } from '@sveltejs/kit';
import { safeNext } from '#lib/server/auth';

export const GET: RequestHandler = async ({ locals, url }) => {
	const code = url.searchParams.get('code');
	if (code && locals.supabase) {
		const { error } = await locals.supabase.auth.exchangeCodeForSession(code);
		if (!error) redirect(303, safeNext(url.searchParams.get('next')));
	}
	redirect(303, '/auth/login?error=link_expired');
};
