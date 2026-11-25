import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import {
	adultReturnPath,
	childRouteAllowed,
	enforceChildModeRoute,
	readChildMode,
	reauthenticateAdult
} from '#lib/server/child-mode';
import { handle } from '../../src/hooks.server';
import { load as layoutLoad } from '../../src/routes/+layout.server';
import {
	actions as adultActions,
	load as adultLoad
} from '../../src/routes/auth/adult/+page.server';
import { POST as enter } from '../../src/routes/play/[heroId]/enter/+server';

const mocks = vi.hoisted(() => ({
	createClient: vi.fn(),
	createServerClient: vi.fn(),
	isConfigured: vi.fn(() => true)
}));
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }));
vi.mock('@supabase/ssr', () => ({ createServerClient: mocks.createServerClient }));
vi.mock('#lib/server/supabase', () => ({
	getPublicConfig: () => ({
		url: 'https://local.example.test',
		key: 'nonfunctional-public-fixture'
	}),
	isConfigured: mocks.isConfigured
}));

const origin = 'https://portal.example';
const heroId = '61000000-0000-4000-8000-000000000001';
const siblingId = '61000000-0000-4000-8000-000000000002';
const user = { id: '62000000-0000-4000-8000-000000000001', email: 'adult@example.test' } as User;
const mode = { heroId };
const session = {
	access_token: 'nonfunctional-new-access-fixture',
	refresh_token: 'nonfunctional-new-refresh-fixture',
	user
};
const password = 'nonfunctional-fixture-password';
function makeClient() {
	return {
		rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
		from: vi.fn(),
		auth: {
			getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
			signInWithPassword: vi.fn().mockResolvedValue({ data: { user, session }, error: null }),
			setSession: vi.fn().mockResolvedValue({ data: { user, session }, error: null }),
			signOut: vi.fn().mockResolvedValue({ error: null })
		}
	};
}
type ClientMock = ReturnType<typeof makeClient>;
function asClient(client: ClientMock): SupabaseClient {
	return client as unknown as SupabaseClient;
}
function eventFor(
	routeId = '/auth/adult',
	method = 'GET',
	path = '/auth/adult',
	client = makeClient(),
	fields?: Record<string, string>
): RequestEvent {
	const request = new Request(origin + path, {
		method,
		headers: { Origin: origin },
		body: fields ? new URLSearchParams(fields) : undefined
	});
	return {
		request,
		url: new URL(request.url),
		route: { id: routeId },
		params: { heroId },
		locals: {
			user,
			role: 'root_admin',
			supabase: asClient(client),
			childMode: mode,
			locale: 'ru',
			configured: true
		},
		cookies: { get: vi.fn(), getAll: vi.fn(() => []), set: vi.fn() }
	} as unknown as RequestEvent;
}
beforeEach(() => {
	vi.clearAllMocks();
	mocks.isConfigured.mockReturnValue(true);
});

describe('child route boundary', () => {
	it.each([
		['/play/[heroId]', 'GET', true],
		['/play/[heroId]', 'POST', false],
		['/play/[heroId]/enter', 'POST', true],
		['/learn/[lessonId]', 'GET', true],
		['/learn/[lessonId]', 'POST', true],
		['/auth/adult', 'GET', true],
		['/auth/adult', 'POST', true],
		['/auth/logout', 'POST', true],
		['/auth/logout', 'GET', false],
		['/locale', 'POST', true],
		['/family', 'GET', false],
		['/family', 'POST', false],
		['/admin/ai', 'GET', false],
		['/api/ai/draft', 'POST', false],
		['/auth/login', 'POST', false],
		['/auth/reset', 'POST', false],
		['/auth/callback', 'GET', false],
		['/health', 'GET', true]
	])('scopes %s %s to the child allowlist', (route, method, allowed) => {
		expect(childRouteAllowed(route, method, { heroId }, route, mode)).toBe(allowed);
	});
	it('cannot switch to a sibling or use an asset-looking dynamic route', () => {
		expect(
			childRouteAllowed('/play/[heroId]', 'GET', { heroId: siblingId }, `/play/${siblingId}`, mode)
		).toBe(false);
		expect(
			childRouteAllowed(
				'/play/[heroId]/enter',
				'POST',
				{ heroId: siblingId },
				`/play/${siblingId}/enter`,
				mode
			)
		).toBe(false);
		expect(childRouteAllowed('/api/ai/draft', 'GET', {}, '/_app/fake', mode)).toBe(false);
		expect(childRouteAllowed(null, 'POST', {}, '/_app/fake', mode)).toBe(false);
		expect(childRouteAllowed(null, 'GET', {}, '/_app/immutable/chunk.js', mode)).toBe(true);
	});
	it('guards framework data requests by their resolved route', () => {
		const event = eventFor('/family', 'GET', '/family/__data.json');
		expect(() => enforceChildModeRoute(event)).toThrow(expect.objectContaining({ status: 303 }));
	});
	it('denies private mutations before they run and redirects private reads to reauth', () => {
		expect(() => enforceChildModeRoute(eventFor('/admin/ai', 'POST', '/admin/ai'))).toThrow(
			expect.objectContaining({ status: 403 })
		);
		expect(() => enforceChildModeRoute(eventFor('/studio', 'GET', '/studio'))).toThrow(
			expect.objectContaining({ status: 303, location: '/auth/adult?next=%2Fstudio' })
		);
	});
	it('never forwards auth callback codes or external locations through adult return URLs', () => {
		expect(adultReturnPath('/auth/callback?code=sensitive-fixture')).toBe('/family');
		expect(adultReturnPath('//foreign.example')).toBe('/family');
		expect(adultReturnPath('/%2f%2fforeign.example')).toBe('/family');
		expect(adultReturnPath('/api/ai/draft')).toBe('/family');
		expect(adultReturnPath('/studio/lessons?language=ru')).toBe('/studio/lessons?language=ru');
	});
});

describe('database lock resolution', () => {
	it('accepts only null or a valid active hero from the trusted RPC', async () => {
		const client = makeClient();
		expect(await readChildMode(asClient(client))).toBeNull();
		client.rpc.mockResolvedValueOnce({ data: { hero_id: heroId }, error: null });
		expect(await readChildMode(asClient(client))).toEqual(mode);
		expect(client.rpc).toHaveBeenCalledWith('get_child_mode');
	});
	it.each([undefined, {}, [], { hero_id: 'bad-id' }, { heroId }])(
		'fails closed for malformed mode %j',
		async (data) => {
			const client = makeClient();
			client.rpc.mockResolvedValueOnce({ data, error: null });
			await expect(readChildMode(asClient(client))).rejects.toMatchObject({ status: 503 });
		}
	);
	it('fails closed on missing migration and network errors without provider detail', async () => {
		const client = makeClient();
		client.rpc.mockResolvedValueOnce({
			data: null,
			error: { message: 'private-detail', code: 'PGRST202' }
		});
		await expect(readChildMode(asClient(client))).rejects.toMatchObject({
			status: 503,
			body: { message: 'child_mode_unavailable' }
		});
		client.rpc.mockRejectedValueOnce(new Error('private-detail'));
		await expect(readChildMode(asClient(client))).rejects.toMatchObject({
			status: 503,
			body: { message: 'child_mode_unavailable' }
		});
	});
});

describe('request hook and child payload', () => {
	it('rechecks the lock before any role query and suppresses the adult role', async () => {
		const client = makeClient();
		client.rpc.mockResolvedValue({ data: { hero_id: heroId }, error: null });
		mocks.createServerClient.mockReturnValue(client);
		const event = eventFor('/play/[heroId]', 'GET', `/play/${heroId}`, client);
		const resolve = vi.fn().mockResolvedValue(new Response('game'));
		await handle({ event, resolve } as Parameters<typeof handle>[0]);
		expect(client.rpc).toHaveBeenCalledWith('get_child_mode');
		expect(client.from).not.toHaveBeenCalled();
		expect(event.locals.role).toBeNull();
		expect(event.locals.childMode).toEqual(mode);
		expect(resolve).toHaveBeenCalledOnce();
	});
	it('does not execute a forbidden request or resolve a page if the mode query fails', async () => {
		const client = makeClient();
		mocks.createServerClient.mockReturnValue(client);
		client.rpc.mockResolvedValue({ data: { hero_id: heroId }, error: null });
		const resolve = vi.fn();
		await expect(
			handle({
				event: eventFor('/auth/callback', 'GET', '/auth/callback?code=fixture', client),
				resolve
			} as Parameters<typeof handle>[0])
		).rejects.toMatchObject({ status: 303 });
		client.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } });
		await expect(
			handle({ event: eventFor('/family', 'GET', '/family', client), resolve } as Parameters<
				typeof handle
			>[0])
		).rejects.toMatchObject({ status: 503 });
		expect(resolve).not.toHaveBeenCalled();
		expect(client.from).not.toHaveBeenCalled();
	});
	it('never sends adult email, account ID or role in locked layout data', async () => {
		const event = eventFor();
		const data = await layoutLoad(event as Parameters<typeof layoutLoad>[0]);
		expect(data).toMatchObject({ user: null, role: null, childMode: mode });
		expect(JSON.stringify(data)).not.toContain(user.email);
		expect(JSON.stringify(data)).not.toContain(user.id);
	});
});

describe('isolated adult password verification', () => {
	it('verifies the existing adult account and installs only its fresh unlocked session', async () => {
		const current = makeClient();
		const verifier = makeClient();
		mocks.createClient.mockReturnValue(verifier);
		await reauthenticateAdult(user, asClient(current), password);
		expect(current.rpc).toHaveBeenCalledWith('reserve_adult_reauth');
		expect(mocks.createClient).toHaveBeenCalledWith(
			'https://local.example.test',
			'nonfunctional-public-fixture',
			{ auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
		);
		expect(verifier.auth.signInWithPassword).toHaveBeenCalledWith({ email: user.email, password });
		expect(verifier.rpc).toHaveBeenCalledWith('get_child_mode');
		expect(current.auth.signInWithPassword).not.toHaveBeenCalled();
		expect(current.auth.setSession).toHaveBeenCalledWith({
			access_token: session.access_token,
			refresh_token: session.refresh_token
		});
	});
	it('wrong password cannot replace the locked browser session', async () => {
		const current = makeClient();
		const verifier = makeClient();
		verifier.auth.signInWithPassword.mockResolvedValue({
			data: { user: null, session: null },
			error: { status: 400, message: 'private-detail' }
		});
		mocks.createClient.mockReturnValue(verifier);
		await expect(reauthenticateAdult(user, asClient(current), password)).rejects.toMatchObject({
			code: 'adult_password_invalid',
			status: 401
		});
		expect(current.auth.setSession).not.toHaveBeenCalled();
		expect(verifier.rpc).not.toHaveBeenCalled();
	});
	it('rejects a different account even after a provider reports successful authentication', async () => {
		const current = makeClient();
		const verifier = makeClient();
		verifier.auth.signInWithPassword.mockResolvedValue({
			data: { user: { ...user, id: 'foreign-user' }, session },
			error: null
		});
		mocks.createClient.mockReturnValue(verifier);
		await expect(reauthenticateAdult(user, asClient(current), password)).rejects.toMatchObject({
			code: 'adult_password_invalid'
		});
		expect(current.auth.setSession).not.toHaveBeenCalled();
		expect(verifier.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
	});
	it('a refreshed old session still locked in the database cannot be installed as adult', async () => {
		const current = makeClient();
		const verifier = makeClient();
		verifier.rpc.mockResolvedValue({ data: { hero_id: heroId }, error: null });
		mocks.createClient.mockReturnValue(verifier);
		await expect(reauthenticateAdult(user, asClient(current), password)).rejects.toMatchObject({
			code: 'adult_reauth_unavailable'
		});
		expect(current.auth.setSession).not.toHaveBeenCalled();
		expect(verifier.auth.signOut).toHaveBeenCalledOnce();
	});
	it('database errors after password verification do not unlock the browser', async () => {
		const current = makeClient();
		const verifier = makeClient();
		verifier.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } });
		mocks.createClient.mockReturnValue(verifier);
		await expect(reauthenticateAdult(user, asClient(current), password)).rejects.toMatchObject({
			code: 'adult_reauth_unavailable'
		});
		expect(current.auth.setSession).not.toHaveBeenCalled();
		expect(verifier.auth.signOut).toHaveBeenCalledOnce();
	});
	it('rate-limited attempts never reach password verification', async () => {
		const current = makeClient();
		current.rpc.mockResolvedValue({ data: null, error: { code: 'P0001' } });
		await expect(reauthenticateAdult(user, asClient(current), password)).rejects.toMatchObject({
			code: 'adult_reauth_rate_limited',
			status: 429
		});
		expect(mocks.createClient).not.toHaveBeenCalled();
		expect(current.auth.setSession).not.toHaveBeenCalled();
	});
	it('uses bounded form password only and never echoes it or a posted email', async () => {
		const current = makeClient();
		const verifier = makeClient();
		verifier.auth.signInWithPassword.mockResolvedValue({
			data: { user: null, session: null },
			error: { status: 400 }
		});
		mocks.createClient.mockReturnValue(verifier);
		const event = eventFor('/auth/adult', 'POST', '/auth/adult', current, {
			password,
			next: '/family',
			email: 'foreign@example.test'
		});
		const result = await adultActions.default(event as Parameters<typeof adultActions.default>[0]);
		expect(result).toMatchObject({ status: 401, data: { error: 'adult_password_invalid' } });
		expect(JSON.stringify(result)).not.toContain(password);
		expect(JSON.stringify(result)).not.toContain('foreign@example.test');
		expect(verifier.auth.signInWithPassword).toHaveBeenCalledWith({ email: user.email, password });
		expect(event.locals.childMode).toEqual(mode);
	});
	it('redirects after successful reauth and does not return tokens in action data', async () => {
		const current = makeClient();
		mocks.createClient.mockReturnValue(makeClient());
		const event = eventFor('/auth/adult', 'POST', '/auth/adult', current, {
			password,
			next: '/studio'
		});
		await expect(
			adultActions.default(event as Parameters<typeof adultActions.default>[0])
		).rejects.toMatchObject({ status: 303, location: '/studio' });
		expect(event.locals.childMode).toBeNull();
		expect(current.auth.setSession).toHaveBeenCalledOnce();
	});
	it('unlocked adults do not get stuck on the password screen', () => {
		const event = eventFor();
		event.locals.childMode = null;
		expect(() => adultLoad(event as Parameters<typeof adultLoad>[0])).toThrow(
			expect.objectContaining({ status: 303, location: '/family' })
		);
	});
});

describe('entering child mode', () => {
	it('calls the user-scoped lock RPC before redirecting to the active hero', async () => {
		const client = makeClient();
		client.rpc.mockResolvedValue({ data: { hero_id: heroId }, error: null });
		const event = eventFor('/play/[heroId]/enter', 'POST', `/play/${heroId}/enter`, client);
		await expect(enter(event as Parameters<typeof enter>[0])).rejects.toMatchObject({
			status: 303,
			location: `/play/${heroId}`
		});
		expect(client.rpc).toHaveBeenCalledWith('enter_child_mode', { p_child_profile_id: heroId });
	});
	it('a lock failure never redirects into an unprotected game', async () => {
		const client = makeClient();
		client.rpc.mockResolvedValue({
			data: null,
			error: { code: '42501', message: 'private-detail' }
		});
		const event = eventFor('/play/[heroId]/enter', 'POST', `/play/${heroId}/enter`, client);
		await expect(enter(event as Parameters<typeof enter>[0])).rejects.toMatchObject({
			status: 403,
			body: { message: 'child_mode_forbidden' }
		});
	});
});
