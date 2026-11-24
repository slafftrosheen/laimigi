import { fail, isHttpError } from '@sveltejs/kit';
import { requireRoot } from '#lib/server/auth';
import { readBoundedForm } from '#lib/server/http';
import { encryptApiKey, encryptionReady, validateApiKey } from '#lib/server/ai/crypto';
import { getEncryptionKey } from '#lib/server/ai/runtime';
import {
	PROVIDER_METADATA_COLUMNS,
	runAiRequest,
	serviceReady,
	translateDatabaseError
} from '#lib/server/ai/service';
import {
	AI_PROVIDERS,
	AiError,
	defaultProviderSettings,
	parseProvider,
	safeAiError,
	type ProviderSettings
} from '#lib/server/ai/types';
import { integerSetting, validateModel } from '#lib/server/ai/validation';
import type { Actions, PageServerLoad } from './$types';

function safeFormError(error: unknown): AiError {
	if (isHttpError(error) && [400, 413, 415].includes(error.status)) {
		return new AiError('ai_invalid_input', error.status);
	}
	return safeAiError(error);
}

export const load: PageServerLoad = async (event) => {
	const { supabase } = await requireRoot(event);
	const { data, error } = await supabase
		.from('ai_provider_settings')
		.select(PROVIDER_METADATA_COLUMNS);
	return {
		providers: AI_PROVIDERS.map(
			(provider) =>
				(data as ProviderSettings[] | null)?.find((item) => item.provider === provider) ??
				defaultProviderSettings(provider)
		),
		encryptionReady: encryptionReady(getEncryptionKey()),
		serviceReady: serviceReady(),
		...(error ? { error: 'ai_settings_unavailable' } : {})
	};
};

export const actions: Actions = {
	save: async (event) => {
		const { supabase } = await requireRoot(event);
		try {
			const form = await readBoundedForm(event.request, 8_000);
			const provider = parseProvider(form.get('provider'));
			const enabled = form.get('enabled') === 'on' || form.get('enabled') === 'true';
			const model = validateModel(form.get('model'));
			const maxOutputTokens = integerSetting(form.get('max_output_tokens'), 64, 4096);
			const dailyLimit = integerSetting(form.get('daily_request_limit'), 1, 10_000);
			const rawKey = form.get('api_key');
			if (rawKey !== null && typeof rawKey !== 'string') throw new AiError('ai_invalid_input', 400);
			const apiKey = typeof rawKey === 'string' && rawKey.trim() ? validateApiKey(rawKey) : null;
			if ((enabled || apiKey) && !encryptionReady(getEncryptionKey()))
				throw new AiError('ai_encryption_unavailable');
			const { error } = await supabase.rpc('configure_ai_provider', {
				p_provider: provider,
				p_model: model,
				p_enabled: enabled,
				p_max_output_tokens: maxOutputTokens,
				p_daily_request_limit: dailyLimit,
				p_ciphertext: apiKey ? encryptApiKey(apiKey, provider, getEncryptionKey()) : null,
				p_key_hint: apiKey ? apiKey.slice(-4) : null,
				p_remove_key: false
			});
			if (error) throw translateDatabaseError(error);
			return { success: true, message: 'ai_settings_saved', provider };
		} catch (error) {
			const safe = safeFormError(error);
			// Never return submitted form fields: the API key is part of that form.
			return fail(safe.status, { error: safe.code });
		}
	},
	test: async (event) => {
		const { user } = await requireRoot(event);
		try {
			const provider = parseProvider((await readBoundedForm(event.request, 8_000)).get('provider'));
			await runAiRequest({
				userId: user.id,
				provider,
				prompt: 'Reply with the single word READY.',
				instructions: 'This is an administrator connection test. Return only READY.',
				test: true,
				signal: event.request.signal
			});
			return { success: true, message: 'ai_test_passed', provider };
		} catch (error) {
			const safe = safeFormError(error);
			return fail(safe.status, { error: safe.code });
		}
	},
	remove: async (event) => {
		const { supabase } = await requireRoot(event);
		try {
			const provider = parseProvider((await readBoundedForm(event.request, 8_000)).get('provider'));
			const { data: current, error: readError } = await supabase
				.from('ai_provider_settings')
				.select(PROVIDER_METADATA_COLUMNS)
				.eq('provider', provider)
				.single();
			if (readError || !current) throw new AiError('ai_settings_unavailable');
			const { error } = await supabase.rpc('configure_ai_provider', {
				p_provider: provider,
				p_model: current.model,
				p_enabled: false,
				p_max_output_tokens: current.max_output_tokens,
				p_daily_request_limit: current.daily_request_limit,
				p_ciphertext: null,
				p_key_hint: null,
				p_remove_key: true
			});
			if (error) throw translateDatabaseError(error);
			return { success: true, message: 'ai_key_removed', provider };
		} catch (error) {
			const safe = safeFormError(error);
			return fail(safe.status, { error: safe.code });
		}
	}
};
