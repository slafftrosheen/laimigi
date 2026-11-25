import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { error, redirect, type RequestEvent } from '@sveltejs/kit';
import { safeNext } from '#lib/server/auth';
import { getPublicConfig } from '#lib/server/supabase';

export type ChildMode = { heroId: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The trusted database resolves this from auth.uid() and the signed JWT session_id. */
export async function readChildMode(supabase: SupabaseClient): Promise<ChildMode | null> {
	try {
		const { data, error: queryError } = await supabase.rpc('get_child_mode');
		if (queryError) error(503, 'child_mode_unavailable');
		if (data === null) return null;
		if (
			!data ||
			typeof data !== 'object' ||
			Array.isArray(data) ||
			typeof data.hero_id !== 'string' ||
			!UUID.test(data.hero_id)
		)
			error(503, 'child_mode_unavailable');
		return { heroId: data.hero_id };
	} catch {
		// A missing migration or failed lock check must never downgrade to an adult session.
		error(503, 'child_mode_unavailable');
	}
}

/** Never carry auth callback tokens or mutation paths through a reauthentication redirect. */
export function adultReturnPath(value: string | null | undefined): string {
	const path = safeNext(value);
	const pathname = new URL(path, 'https://internal.invalid').pathname;
	return ['/family', '/learn', '/studio', '/admin'].some(
		(base) => pathname === base || pathname.startsWith(`${base}/`)
	)
		? path
		: '/family';
}

export function childRouteAllowed(
	routeId: string | null,
	method: string,
	params: Record<string, string | undefined>,
	pathname: string,
	mode: ChildMode
): boolean {
	const readOnly = method === 'GET' || method === 'HEAD';
	if (routeId === '/auth/adult') return readOnly || method === 'POST';
	if (routeId === '/auth/logout' || routeId === '/locale') return method === 'POST';
	if (routeId === '/health') return readOnly;
	if (routeId === '/play/[heroId]') return readOnly && params.heroId === mode.heroId;
	if (routeId === '/play/[heroId]/enter') return method === 'POST' && params.heroId === mode.heroId;
	if (routeId === '/learn/[lessonId]') return readOnly || method === 'POST';
	// Framework/static resources have no application route. Never allow a dynamic route
	// merely because its URL resembles an asset path.
	return (
		routeId === null &&
		readOnly &&
		(pathname.startsWith('/_app/') || pathname === '/favicon.svg' || pathname === '/robots.txt')
	);
}

export function enforceChildModeRoute(event: RequestEvent): void {
	const mode = event.locals.childMode;
	if (
		!mode ||
		childRouteAllowed(event.route.id, event.request.method, event.params, event.url.pathname, mode)
	)
		return;
	if (event.request.method === 'GET' || event.request.method === 'HEAD') {
		const next = adultReturnPath(event.url.pathname + event.url.search);
		redirect(303, `/auth/adult?next=${encodeURIComponent(next)}`);
	}
	error(403, 'child_mode_forbidden');
}

export type AdultReauthCode =
	| 'adult_password_invalid'
	| 'adult_reauth_unavailable'
	| 'adult_account_unavailable'
	| 'adult_reauth_rate_limited';

export class AdultReauthError extends Error {
	constructor(
		public readonly code: AdultReauthCode,
		public readonly status = 503
	) {
		super(code);
		this.name = 'AdultReauthError';
	}
}

async function discardVerifiedSession(verifier: SupabaseClient): Promise<void> {
	try {
		await verifier.auth.signOut({ scope: 'local' });
	} catch {
		/* No tokens or provider errors in logs. */
	}
}

/** Password verification is isolated: unsuccessful attempts cannot overwrite browser cookies. */
export async function reauthenticateAdult(
	user: User,
	currentClient: SupabaseClient,
	password: string
): Promise<void> {
	if (!user.email) throw new AdultReauthError('adult_account_unavailable', 400);
	let admission;
	try {
		admission = await currentClient.rpc('reserve_adult_reauth');
	} catch {
		throw new AdultReauthError('adult_reauth_unavailable');
	}
	if (admission.error) {
		if (admission.error.code === 'P0001')
			throw new AdultReauthError('adult_reauth_rate_limited', 429);
		throw new AdultReauthError('adult_reauth_unavailable');
	}
	const { url, key } = getPublicConfig();
	const verifier = createClient(url, key, {
		auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
	});
	let verified;
	try {
		verified = await verifier.auth.signInWithPassword({ email: user.email, password });
	} catch {
		throw new AdultReauthError('adult_reauth_unavailable');
	}
	if (verified.error) {
		if (verified.error.status === 429) throw new AdultReauthError('adult_reauth_rate_limited', 429);
		if (verified.error.status && verified.error.status >= 500)
			throw new AdultReauthError('adult_reauth_unavailable');
		throw new AdultReauthError('adult_password_invalid', 401);
	}
	const session = verified.data.session;
	if (!session || verified.data.user?.id !== user.id || session.user.id !== user.id) {
		await discardVerifiedSession(verifier);
		throw new AdultReauthError('adult_password_invalid', 401);
	}
	try {
		// This uses the new, server-issued JWT. A refreshed old session stays locked and
		// cannot satisfy the check. Do not trust a locally decoded session_id to unlock.
		if (await readChildMode(verifier)) throw new AdultReauthError('adult_reauth_unavailable');
	} catch {
		await discardVerifiedSession(verifier);
		throw new AdultReauthError('adult_reauth_unavailable');
	}
	let installed;
	try {
		installed = await currentClient.auth.setSession({
			access_token: session.access_token,
			refresh_token: session.refresh_token
		});
	} catch {
		await discardVerifiedSession(verifier);
		throw new AdultReauthError('adult_reauth_unavailable');
	}
	if (
		installed.error ||
		installed.data.session?.user.id !== user.id ||
		installed.data.user?.id !== user.id
	) {
		await discardVerifiedSession(verifier);
		throw new AdultReauthError('adult_reauth_unavailable');
	}
}
