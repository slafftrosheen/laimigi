import { describe, expect, it, vi } from 'vitest';
import { complete, type CompletionInput } from '../../src/lib/server/ai/providers';

const input: CompletionInput = {
	provider: 'openai',
	model: 'configured-model',
	apiKey: 'test-only-nonfunctional-provider-token',
	prompt: 'Prepare a draft.',
	instructions: 'For educator review.',
	maxOutputTokens: 1024
};

describe('AI provider adapters', () => {
	it('uses the fixed OpenAI Responses endpoint and disables response storage', async () => {
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
			Response.json({
				status: 'completed',
				output: [
					{ type: 'reasoning', summary: [] },
					{ type: 'message', content: [{ type: 'output_text', text: 'Reviewed draft' }] }
				]
			})
		);
		expect(await complete(input, fetcher)).toEqual({ text: 'Reviewed draft', truncated: false });
		const [url, init] = fetcher.mock.calls[0];
		expect(url).toBe('https://api.openai.com/v1/responses');
		expect(init?.redirect).toBe('error');
		expect(JSON.parse(String(init?.body))).toMatchObject({
			model: input.model,
			store: false,
			max_output_tokens: 1024
		});
	});

	it('uses OpenRouter chat completions and reports truncated output', async () => {
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
			Response.json({
				choices: [{ message: { content: 'First part' }, finish_reason: 'length' }]
			})
		);
		expect(await complete({ ...input, provider: 'openrouter' }, fetcher)).toEqual({
			text: 'First part',
			truncated: true
		});
		const [url, init] = fetcher.mock.calls[0];
		expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
		expect(JSON.parse(String(init?.body))).toMatchObject({
			messages: [
				{ role: 'system', content: input.instructions },
				{ role: 'user', content: input.prompt }
			],
			max_tokens: 1024,
			stream: false
		});
	});

	it.each([
		[401, 'ai_provider_rejected'],
		[429, 'ai_rate_limited'],
		[503, 'ai_provider_unavailable']
	])('sanitizes provider HTTP %s errors without returning their bodies', async (status, code) => {
		const fetcher = vi
			.fn<typeof fetch>()
			.mockResolvedValue(new Response(input.apiKey, { status: Number(status) }));
		await expect(complete(input, fetcher)).rejects.toMatchObject({ code, message: code });
	});

	it('sanitizes low-level fetch errors', async () => {
		const fetcher = vi
			.fn<typeof fetch>()
			.mockRejectedValue(new Error(`Request contained ${input.apiKey}`));
		await expect(complete(input, fetcher)).rejects.toMatchObject({
			message: 'ai_provider_unavailable'
		});
	});

	it('times out a stalled upstream request', async () => {
		vi.useFakeTimers();
		try {
			const fetcher: typeof fetch = async (_url, init) =>
				new Promise<Response>((_resolve, reject) => {
					init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), {
						once: true
					});
				});
			const pending = complete(input, fetcher, 1000);
			const assertion = expect(pending).rejects.toMatchObject({ code: 'ai_timeout', status: 504 });
			await vi.advanceTimersByTimeAsync(1000);
			await assertion;
		} finally {
			vi.useRealTimers();
		}
	});

	it('bounds the actual response body even when no Content-Length is present', async () => {
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('x'.repeat(1_000_001)));
		await expect(complete(input, fetcher)).rejects.toMatchObject({ code: 'ai_response_too_large' });
	});

	it('rejects malformed, empty and excessively long completion output', async () => {
		await expect(
			complete(input, vi.fn<typeof fetch>().mockResolvedValue(new Response('not json')))
		).rejects.toMatchObject({ code: 'ai_provider_unavailable' });
		await expect(
			complete(input, vi.fn<typeof fetch>().mockResolvedValue(Response.json({ output: [] })))
		).rejects.toMatchObject({ code: 'ai_empty_response' });
		await expect(
			complete(
				{ ...input, provider: 'openrouter' },
				vi
					.fn<typeof fetch>()
					.mockResolvedValue(
						Response.json({ choices: [{ message: { content: 'x'.repeat(24_001) } }] })
					)
			)
		).rejects.toMatchObject({ code: 'ai_response_too_large' });
	});
});
