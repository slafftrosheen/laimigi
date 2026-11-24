import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { actions } from '../../src/routes/admin/ai/+page.server';
import { POST } from '../../src/routes/api/ai/draft/+server';
import { runAiRequest } from '../../src/lib/server/ai/service';
import { decryptApiKey } from '../../src/lib/server/ai/crypto';

vi.mock('../../src/lib/server/ai/runtime', () => ({
	getEncryptionKey: () => process.env.AI_SETTINGS_ENCRYPTION_KEY
}));

vi.mock('../../src/lib/server/ai/service', () => ({
	PROVIDER_METADATA_COLUMNS:
		'provider,model,enabled,max_output_tokens,daily_request_limit,key_hint,updated_at',
	runAiRequest: vi.fn(),
	draftInstructions: () => 'For educator review.',
	serviceReady: () => true,
	translateDatabaseError: vi.fn()
}));

const origin = 'https://laimigi.example';
const user = { id: 'e0be1592-86e7-45a2-a119-2da1eab9209c' } as User;
const secret = 'test-only-nonfunctional-provider-token';

function event(
	role: 'parent' | 'teacher' | 'admin' | 'root_admin',
	request: Request,
	rpc = vi.fn().mockResolvedValue({ data: null, error: null })
): RequestEvent {
	return {
		request,
		url: new URL(request.url),
		locals: { user, role, supabase: { rpc } as unknown as SupabaseClient }
	} as RequestEvent;
}

function draftRequest(requestOrigin = origin): Request {
	return new Request(`${origin}/api/ai/draft`, {
		method: 'POST',
		headers: { Origin: requestOrigin, 'Content-Type': 'application/json' },
		body: JSON.stringify({
			provider: 'openai',
			prompt: 'Draft a learning activity.',
			locale: 'lv',
			age_band: '7-9'
		})
	});
}

afterEach(() => {
	vi.clearAllMocks();
	vi.unstubAllEnvs();
});

describe('AI route authorization and credential handling', () => {
	it.each(['save', 'test', 'remove'])(
		'denies teacher access to root-only action %s',
		async (action) => {
			const request = new Request(`${origin}/admin/ai`, {
				method: 'POST',
				body: new URLSearchParams({ provider: 'openai' })
			});
			const rpc = vi.fn();
			await expect(
				actions[action](event('teacher', request, rpc) as Parameters<(typeof actions)[string]>[0])
			).rejects.toMatchObject({ status: 403 });
			expect(rpc).not.toHaveBeenCalled();
			expect(runAiRequest).not.toHaveBeenCalled();
		}
	);

	it('does not grant AI generation to parent sessions', async () => {
		await expect(
			POST(event('parent', draftRequest()) as Parameters<typeof POST>[0])
		).rejects.toMatchObject({ status: 403 });
		expect(runAiRequest).not.toHaveBeenCalled();
	});

	it('rejects cross-origin JSON mutations even for a root session', async () => {
		await expect(
			POST(
				event('root_admin', draftRequest('https://foreign.example')) as Parameters<typeof POST>[0]
			)
		).rejects.toMatchObject({ status: 403 });
		expect(runAiRequest).not.toHaveBeenCalled();
	});

	it('uses the authenticated staff user, and returns a non-cacheable draft for review', async () => {
		vi.mocked(runAiRequest).mockResolvedValue({
			text: 'Draft',
			truncated: false,
			provider: 'openai',
			model: 'configured-model',
			requestId: 'request-id',
			reviewRequired: true
		});
		const response = await POST(event('teacher', draftRequest()) as Parameters<typeof POST>[0]);
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(await response.json()).toMatchObject({ text: 'Draft', reviewRequired: true });
		expect(runAiRequest).toHaveBeenCalledWith(
			expect.objectContaining({ userId: user.id, provider: 'openai' })
		);
	});

	it('encrypts a saved key and never includes the form or key in the action result', async () => {
		const master = Buffer.alloc(32, 11).toString('base64');
		vi.stubEnv('AI_SETTINGS_ENCRYPTION_KEY', master);
		const body = new URLSearchParams({
			provider: 'openai',
			model: 'configured-model',
			enabled: 'on',
			max_output_tokens: '1024',
			daily_request_limit: '20',
			api_key: secret
		});
		const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
		const result = await actions.save(
			event(
				'root_admin',
				new Request(`${origin}/admin/ai`, { method: 'POST', body }),
				rpc
			) as Parameters<typeof actions.save>[0]
		);
		expect(result).toEqual({ success: true, message: 'ai_settings_saved', provider: 'openai' });
		expect(JSON.stringify(result)).not.toContain(secret);
		const args = rpc.mock.calls[0][1];
		expect(args.p_key_hint).toBe(secret.slice(-4));
		expect(args.p_ciphertext).not.toContain(secret);
		expect(decryptApiKey(args.p_ciphertext, 'openai', master)).toBe(secret);
	});

	it('does not echo submitted secrets when validation fails', async () => {
		const body = new URLSearchParams({
			provider: 'openai',
			model: 'invalid model',
			api_key: secret
		});
		const rpc = vi.fn();
		const result = await actions.save(
			event(
				'root_admin',
				new Request(`${origin}/admin/ai`, { method: 'POST', body }),
				rpc
			) as Parameters<typeof actions.save>[0]
		);
		expect(result).toMatchObject({ status: 400, data: { error: 'ai_invalid_input' } });
		expect(JSON.stringify(result)).not.toContain(secret);
		expect(rpc).not.toHaveBeenCalled();
	});
});
