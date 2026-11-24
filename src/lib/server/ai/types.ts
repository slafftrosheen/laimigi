export const AI_PROVIDERS = ['openrouter', 'openai'] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export type ProviderSettings = {
	provider: AiProvider;
	model: string;
	enabled: boolean;
	max_output_tokens: number;
	daily_request_limit: number;
	key_hint: string | null;
	updated_at: string | null;
};

export type AiErrorCode =
	| 'ai_invalid_input'
	| 'ai_encryption_unavailable'
	| 'ai_secret_invalid'
	| 'ai_settings_unavailable'
	| 'ai_service_unavailable'
	| 'ai_not_configured'
	| 'ai_disabled'
	| 'ai_rate_limited'
	| 'ai_access_denied'
	| 'ai_provider_rejected'
	| 'ai_provider_unavailable'
	| 'ai_timeout'
	| 'ai_empty_response'
	| 'ai_response_too_large';

/** Public-safe errors. Provider bodies, credentials and database errors never enter messages. */
export class AiError extends Error {
	constructor(
		public readonly code: AiErrorCode,
		public readonly status = 503
	) {
		super(code);
		this.name = 'AiError';
	}
}

export function safeAiError(error: unknown): AiError {
	return error instanceof AiError ? error : new AiError('ai_service_unavailable');
}

export function parseProvider(value: unknown): AiProvider {
	if (value !== 'openrouter' && value !== 'openai') {
		throw new AiError('ai_invalid_input', 400);
	}
	return value;
}

export function defaultProviderSettings(provider: AiProvider): ProviderSettings {
	return {
		provider,
		model: '',
		enabled: false,
		max_output_tokens: 1024,
		daily_request_limit: 100,
		key_hint: null,
		updated_at: null
	};
}
