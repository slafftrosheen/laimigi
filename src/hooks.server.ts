import { createServerClient } from '@supabase/ssr';
import type { Handle, HandleServerError } from '@sveltejs/kit/hooks';
import { APP_ROLES, LOCALES, type AppRole, type Locale } from '#lib/types';
import { getPublicConfig, isConfigured } from '#lib/server/supabase';
import { assertSameOrigin } from '#lib/server/http';

export const handle: Handle = async ({ event, resolve }) => {
	// Kit relaxes built-in form CSRF checks in development; the shared online
	// development database still needs the same mutation boundary as production.
	if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(event.request.method)) assertSameOrigin(event);
	const requestedLocale = event.cookies.get('locale');
	event.locals.locale = LOCALES.includes(requestedLocale as Locale)
		? (requestedLocale as Locale)
		: 'lv';
	event.locals.configured = isConfigured();
	event.locals.user = null;
	event.locals.role = null;
	event.locals.supabase = null;
	if (event.locals.configured) {
		const { url, key } = getPublicConfig();
		event.locals.supabase = createServerClient(url, key, {
			cookies: {
				getAll: () => event.cookies.getAll(),
				setAll: (cookies) =>
					cookies.forEach(({ name, value, options }) =>
						event.cookies.set(name, value, {
							...options,
							path: '/',
							httpOnly: true,
							sameSite: 'lax',
							secure: event.url.protocol === 'https:'
						})
					)
			}
		});
		// Verify with Auth, including deleted/revoked users. Never trust getSession alone.
		const {
			data: { user },
			error: authError
		} = await event.locals.supabase.auth.getUser();
		if (!authError && user) {
			event.locals.user = user;
			const { data } = await event.locals.supabase
				.from('user_roles')
				.select('role')
				.eq('user_id', user.id)
				.maybeSingle<{ role: string }>();
			if (data && APP_ROLES.includes(data.role as AppRole))
				event.locals.role = data.role as AppRole;
		}
	}
	const response = await resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%app.locale%', event.locals.locale),
		filterSerializedResponseHeaders: (name) =>
			name === 'content-range' || name === 'x-supabase-api-version'
	});
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	if (event.url.protocol === 'https:')
		response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
	response.headers.set('Cache-Control', 'private, no-store');
	return response;
};

export const handleError: HandleServerError = (caught) => {
	if (caught.kind === 'app') return {};
	if (caught.kind === 'framework' && caught.error.status === 404)
		return { status: 404, message: 'not_found' };
	if (caught.kind === 'validation') return { status: 400, message: 'invalid_input' };
	return { status: 500, message: 'server_error' };
};
