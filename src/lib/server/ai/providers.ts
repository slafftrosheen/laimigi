import { AiError, type AiProvider } from './types';

const ENDPOINTS: Record<AiProvider, string> = {
	openai: 'https://api.openai.com/v1/responses',
	openrouter: 'https://openrouter.ai/api/v1/chat/completions'
};

export type CompletionInput = {
	provider: AiProvider;
	model: string;
	apiKey: string;
	prompt: string;
	instructions: string;
	maxOutputTokens: number;
	signal?: AbortSignal;
};

export type CompletionOutput = { text: string; truncated: boolean };

async function boundedJson(response: Response): Promise<Record<string, unknown>> {
	const limit = 1_000_000;
	if (Number(response.headers.get('content-length') ?? 0) > limit || !response.body) {
		throw new AiError('ai_response_too_large', 502);
	}
	const reader = response.body.getReader();
	let size = 0;
	const chunks: Uint8Array[] = [];
	try {
		while (true) {
			const chunk = await reader.read();
			if (chunk.done) break;
			size += chunk.value.byteLength;
			if (size > limit) {
				await reader.cancel();
				throw new AiError('ai_response_too_large', 502);
			}
			chunks.push(chunk.value);
		}
		const data: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
		if (!data || typeof data !== 'object' || Array.isArray(data)) {
			throw new AiError('ai_provider_unavailable', 502);
		}
		return data as Record<string, unknown>;
	} finally {
		reader.releaseLock();
	}
}

function record(value: unknown): Record<string, unknown> | null {
	return value !== null && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function outputText(provider: AiProvider, data: Record<string, unknown>): CompletionOutput {
	let text: string;
	let truncated: boolean;
	if (provider === 'openai') {
		const output = Array.isArray(data.output) ? data.output : [];
		const pieces: string[] = [];
		for (const item of output) {
			const message = record(item);
			if (message?.type !== 'message' || !Array.isArray(message.content)) continue;
			for (const part of message.content) {
				const content = record(part);
				if (content?.type === 'output_text' && typeof content.text === 'string') {
					pieces.push(content.text);
				}
			}
		}
		text = pieces.join('\n').trim();
		truncated = data.status === 'incomplete';
	} else {
		const choice = record(Array.isArray(data.choices) ? data.choices[0] : null);
		const message = record(choice?.message);
		text = typeof message?.content === 'string' ? message.content.trim() : '';
		truncated = choice?.finish_reason === 'length';
	}
	if (!text) throw new AiError('ai_empty_response', 502);
	if (text.length > 24_000) throw new AiError('ai_response_too_large', 502);
	return { text, truncated };
}

/** Fixed provider hosts; administrator-entered values cannot change the destination. */
export async function complete(
	input: CompletionInput,
	fetcher: typeof fetch = globalThis.fetch,
	timeoutMs = 20_000
): Promise<CompletionOutput> {
	const timeout = new AbortController();
	const timer = setTimeout(() => timeout.abort(), timeoutMs);
	const signal = input.signal ? AbortSignal.any([input.signal, timeout.signal]) : timeout.signal;
	try {
		const body =
			input.provider === 'openai'
				? {
						model: input.model,
						instructions: input.instructions,
						input: input.prompt,
						max_output_tokens: input.maxOutputTokens,
						store: false
					}
				: {
						model: input.model,
						messages: [
							{ role: 'system', content: input.instructions },
							{ role: 'user', content: input.prompt }
						],
						max_tokens: input.maxOutputTokens,
						stream: false
					};
		const response = await fetcher(ENDPOINTS[input.provider], {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${input.apiKey}`,
				'Content-Type': 'application/json',
				...(input.provider === 'openrouter' ? { 'X-Title': 'Laimigi Berni' } : {})
			},
			body: JSON.stringify(body),
			signal,
			redirect: 'error'
		});
		if (!response.ok) {
			// Provider errors can include submitted data. Never parse or return their bodies.
			await response.body?.cancel();
			if (response.status === 429) throw new AiError('ai_rate_limited', 429);
			if (response.status >= 400 && response.status < 500)
				throw new AiError('ai_provider_rejected', 502);
			throw new AiError('ai_provider_unavailable', 502);
		}
		return outputText(input.provider, await boundedJson(response));
	} catch (error) {
		if (error instanceof AiError) throw error;
		if (signal.aborted) throw new AiError('ai_timeout', 504);
		throw new AiError('ai_provider_unavailable', 502);
	} finally {
		clearTimeout(timer);
	}
}
