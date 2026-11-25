import { error, redirect, type RequestEvent } from '@sveltejs/kit';
import type { AppRole } from '#lib/types';

export function requireUser(event: RequestEvent) {
	if (!event.locals.supabase) error(503, 'not_configured');
	if (!event.locals.user) {
		const next = encodeURIComponent(event.url.pathname + event.url.search);
		redirect(303, `/auth/login?next=${next}`);
	}
	return { user: event.locals.user, role: event.locals.role, supabase: event.locals.supabase };
}
export function requireRole(event: RequestEvent, roles: readonly AppRole[]) {
	const context = requireUser(event);
	if (!context.role || !roles.includes(context.role)) error(403, 'forbidden');
	return { ...context, role: context.role };
}
export function requireRoot(event: RequestEvent) {
	return requireRole(event, ['root_admin']);
}

/** Accept only relative in-app paths; never allow a user-controlled external redirect. */
export function safeNext(value: string | null | undefined, fallback = '/family'): string {
	const hasUnsafeCharacter = (path: string) =>
		[...path].some((character) => character === '\\' || character.charCodeAt(0) <= 32);
	if (!value || !value.startsWith('/') || value.startsWith('//') || hasUnsafeCharacter(value))
		return fallback;
	try {
		const decoded = decodeURIComponent(value);
		if (decoded.startsWith('//') || hasUnsafeCharacter(decoded)) return fallback;
		const parsed = new URL(value, 'https://internal.invalid');
		return parsed.origin === 'https://internal.invalid'
			? parsed.pathname + parsed.search + parsed.hash
			: fallback;
	} catch {
		return fallback;
	}
}
