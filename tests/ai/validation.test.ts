import { describe, expect, it } from 'vitest';
import {
	integerSetting,
	readDraftRequest,
	validateDraftInput,
	validateModel
} from '../../src/lib/server/ai/validation';

const valid = {
	provider: 'openai',
	prompt: 'Explain plant growth.',
	locale: 'lv',
	age_band: '7-9'
};

describe('AI request validation', () => {
	it('accepts only the configured providers, supported languages and age bands', () => {
		expect(validateDraftInput(valid)).toEqual(valid);
		expect(() => validateDraftInput({ ...valid, provider: 'http://localhost/admin' })).toThrow(
			'ai_invalid_input'
		);
		expect(() => validateDraftInput({ ...valid, age_band: '3' })).toThrow('ai_invalid_input');
		expect(() => validateDraftInput({ ...valid, locale: 'unknown' })).toThrow('ai_invalid_input');
		expect(() => validateDraftInput({ ...valid, prompt: 'x'.repeat(8001) })).toThrow(
			'ai_invalid_input'
		);
	});

	it('validates model identifiers and numerical limits', () => {
		expect(validateModel('openai/configured-model:free')).toBe('openai/configured-model:free');
		expect(() => validateModel('model\nAuthorization: bad')).toThrow('ai_invalid_input');
		expect(integerSetting('1024', 64, 4096)).toBe(1024);
		expect(() => integerSetting('4097', 64, 4096)).toThrow('ai_invalid_input');
		expect(() => integerSetting('1e3', 64, 4096)).toThrow('ai_invalid_input');
	});

	it('requires JSON and checks stream size independently of declared length', async () => {
		await expect(
			readDraftRequest(
				new Request('https://example.test/api', {
					method: 'POST',
					body: JSON.stringify(valid),
					headers: { 'Content-Type': 'application/json; charset=utf-8' }
				})
			)
		).resolves.toEqual(valid);
		await expect(
			readDraftRequest(
				new Request('https://example.test/api', { method: 'POST', body: JSON.stringify(valid) })
			)
		).rejects.toMatchObject({ status: 415 });
		await expect(
			readDraftRequest(
				new Request('https://example.test/api', {
					method: 'POST',
					body: '{}',
					headers: { 'Content-Type': 'application/jsonscript' }
				})
			)
		).rejects.toMatchObject({ status: 415 });
		await expect(
			readDraftRequest(
				new Request('https://example.test/api', {
					method: 'POST',
					body: 'x'.repeat(32_001),
					headers: { 'Content-Type': 'application/json', 'Content-Length': '1' }
				})
			)
		).rejects.toMatchObject({ status: 413 });
	});
});
