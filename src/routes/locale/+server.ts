import { redirect, type RequestHandler } from '@sveltejs/kit';
import { LOCALES, type Locale } from '#lib/types';
import { assertSameOrigin, readBoundedForm } from '#lib/server/http';
import { safeNext } from '#lib/server/auth';

export const POST: RequestHandler = async (event) => {
	assertSameOrigin(event);
	const form = await readBoundedForm(event.request, 4_000);
	const locale = String(form.get('locale')) as Locale;
	if (LOCALES.includes(locale))
		event.cookies.set('locale', locale, {
			path: '/',
			httpOnly: true,
			secure: event.url.protocol === 'https:',
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 365
		});
	redirect(303, safeNext(String(form.get('next') ?? '/'), '/'));
};
