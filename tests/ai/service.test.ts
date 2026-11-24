import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServiceClient } from '#lib/server/supabase';
import { encryptApiKey } from '../../src/lib/server/ai/crypto';
import { complete } from '../../src/lib/server/ai/providers';
import { runAiRequest } from '../../src/lib/server/ai/service';
import { AiError } from '../../src/lib/server/ai/types';

vi.mock('#lib/server/supabase', () => ({ getServiceClient: vi.fn() }));
vi.mock('../../src/lib/server/ai/providers', () => ({ complete: vi.fn() }));
vi.mock('../../src/lib/server/ai/runtime', () => ({
	getEncryptionKey: () => process.env.AI_SETTINGS_ENCRYPTION_KEY
}));

const key = Buffer.alloc(32, 9).toString('base64');
const token = 'test-only-nonfunctional-provider-token';
const requestId = 'b213c6c6-d452-477a-847a-8ace9b550c75';
const request = {
	userId: 'd6bcad96-99d5-4929-b69d-1c6814acdb33',
	provider: 'openai' as const,
	prompt: 'Test draft',
	instructions: 'For review'
};
const settings = {
	provider: 'openai',
	model: 'configured-model',
	enabled: true,
	max_output_tokens: 1024,
	daily_request_limit: 100,
	key_hint: 'oken',
	updated_at: null
};

function makeClient(
	overrides: { enabled?: boolean; reserveError?: { code: string }; secret?: string | null } = {}
) {
	const query = {
		select: vi.fn(),
		eq: vi.fn(),
		maybeSingle: vi.fn().mockResolvedValue({
			data: {
				...settings,
				...(overrides.enabled === undefined ? {} : { enabled: overrides.enabled })
			},
			error: null
		})
	};
	query.select.mockReturnValue(query);
	query.eq.mockReturnValue(query);
	const rpc = vi.fn(async (name: string) => {
		if (name === 'get_ai_provider_secret')
			return {
				data:
					overrides.secret === undefined ? encryptApiKey(token, 'openai', key) : overrides.secret,
				error: null
			};
		if (name === 'reserve_ai_request')
			return {
				data: overrides.reserveError ? null : requestId,
				error: overrides.reserveError ?? null
			};
		return { data: null, error: null };
	});
	const client = { from: vi.fn().mockReturnValue(query), rpc };
	vi.mocked(getServiceClient).mockReturnValue(client as unknown as SupabaseClient);
	return client;
}

beforeEach(() => {
	vi.stubEnv('AI_SETTINGS_ENCRYPTION_KEY', key);
	vi.mocked(complete).mockResolvedValue({ text: 'Draft for review.', truncated: false });
});
afterEach(() => {
	vi.clearAllMocks();
	vi.unstubAllEnvs();
});

describe('AI request service', () => {
	it('reserves before dispatch, records completion and returns no secret', async () => {
		const client = makeClient();
		const output = await runAiRequest(request);
		expect(output).toMatchObject({ text: 'Draft for review.', requestId, reviewRequired: true });
		expect(JSON.stringify(output)).not.toContain(token);
		expect(client.rpc).toHaveBeenCalledWith('reserve_ai_request', {
			p_user_id: request.userId,
			p_provider: 'openai'
		});
		expect(client.rpc).toHaveBeenLastCalledWith('finish_ai_request', {
			p_request_id: requestId,
			p_status: 'succeeded'
		});
		expect(vi.mocked(complete).mock.invocationCallOrder[0]).toBeGreaterThan(
			client.rpc.mock.invocationCallOrder[1]
		);
	});

	it('makes no provider call for a disabled provider', async () => {
		makeClient({ enabled: false });
		await expect(runAiRequest(request)).rejects.toMatchObject({ code: 'ai_disabled' });
		expect(complete).not.toHaveBeenCalled();
	});

	it.each([
		['P0001', 'ai_rate_limited'],
		['42501', 'ai_access_denied']
	])('respects database gate %s before an external call', async (code, expected) => {
		makeClient({ reserveError: { code } });
		await expect(runAiRequest(request)).rejects.toMatchObject({ code: expected });
		expect(complete).not.toHaveBeenCalled();
	});

	it('fails closed when encrypted credentials are missing or cannot be authenticated', async () => {
		makeClient({ secret: null });
		await expect(runAiRequest(request)).rejects.toMatchObject({ code: 'ai_not_configured' });
		makeClient({ secret: 'corrupt' });
		await expect(runAiRequest(request)).rejects.toMatchObject({ code: 'ai_secret_invalid' });
		expect(complete).not.toHaveBeenCalled();
	});

	it('records failed provider attempts without saving prompt, response or errors', async () => {
		const client = makeClient();
		vi.mocked(complete).mockRejectedValue(new AiError('ai_provider_unavailable'));
		await expect(runAiRequest(request)).rejects.toMatchObject({ code: 'ai_provider_unavailable' });
		expect(client.rpc).toHaveBeenLastCalledWith('finish_ai_request', {
			p_request_id: requestId,
			p_status: 'failed'
		});
		expect(JSON.stringify(client.rpc.mock.calls)).not.toContain(request.prompt);
		expect(JSON.stringify(client.rpc.mock.calls)).not.toContain(token);
	});

	it('admin connection tests also reserve quota and cap output tokens', async () => {
		const client = makeClient();
		await runAiRequest({ ...request, test: true });
		expect(client.rpc).toHaveBeenCalledWith('reserve_ai_request', {
			p_user_id: request.userId,
			p_provider: 'openai'
		});
		expect(complete).toHaveBeenCalledWith(expect.objectContaining({ maxOutputTokens: 256 }));
	});
});
