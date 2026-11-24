import { AiError, parseProvider, type AiProvider } from './types';

export type AiDraftInput = {
	provider: AiProvider;
	prompt: string;
	locale: 'lv' | 'ru' | 'en';
	age_band: '4-6' | '7-9' | '10-12';
};

export function validateDraftInput(value: unknown): AiDraftInput {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new AiError('ai_invalid_input', 400);
	const input = value as Record<string, unknown>;
	const provider = parseProvider(input.provider);
	if (
		typeof input.prompt !== 'string' ||
		input.prompt.trim().length < 5 ||
		input.prompt.length > 8000
	) {
		throw new AiError('ai_invalid_input', 400);
	}
	if (input.locale !== 'lv' && input.locale !== 'ru' && input.locale !== 'en')
		throw new AiError('ai_invalid_input', 400);
	if (input.age_band !== '4-6' && input.age_band !== '7-9' && input.age_band !== '10-12')
		throw new AiError('ai_invalid_input', 400);
	return { provider, prompt: input.prompt.trim(), locale: input.locale, age_band: input.age_band };
}

export function validateModel(value: unknown): string {
	if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:/@+-]{0,159}$/.test(value.trim())) {
		throw new AiError('ai_invalid_input', 400);
	}
	return value.trim();
}

export function integerSetting(value: unknown, min: number, max: number): number {
	if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new AiError('ai_invalid_input', 400);
	const number = Number(value);
	if (!Number.isSafeInteger(number) || number < min || number > max)
		throw new AiError('ai_invalid_input', 400);
	return number;
}

/** Bound the actual request stream; Content-Length is only a preliminary check. */
export async function readDraftRequest(request: Request): Promise<AiDraftInput> {
	const maxBytes = 32_000;
	if (
		request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json'
	) {
		throw new AiError('ai_invalid_input', 415);
	}
	if (Number(request.headers.get('content-length') ?? 0) > maxBytes || !request.body) {
		throw new AiError('ai_invalid_input', 413);
	}
	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			size += value.byteLength;
			if (size > maxBytes) {
				await reader.cancel();
				throw new AiError('ai_invalid_input', 413);
			}
			chunks.push(value);
		}
		return validateDraftInput(JSON.parse(Buffer.concat(chunks).toString('utf8')));
	} catch (error) {
		if (error instanceof AiError) throw error;
		throw new AiError('ai_invalid_input', 400);
	} finally {
		reader.releaseLock();
	}
}
