import { redirect, type RequestHandler } from '@sveltejs/kit';
import { assertSameOrigin } from '#lib/server/http';

export const POST: RequestHandler = async (event) => {
	assertSameOrigin(event);
	await event.locals.supabase?.auth.signOut({ scope: 'local' });
	redirect(303, '/');
};
