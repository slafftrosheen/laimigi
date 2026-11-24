import { describe, expect, it } from 'vitest';
import {
	decryptApiKey,
	encryptApiKey,
	encryptionReady,
	validateApiKey
} from '../../src/lib/server/ai/crypto';

const master = Buffer.alloc(32, 7).toString('base64');
const secret = 'test-only-nonfunctional-provider-token';

describe('provider credential encryption', () => {
	it('round trips and uses a different authenticated nonce for every save', () => {
		const first = encryptApiKey(secret, 'openai', master);
		const second = encryptApiKey(secret, 'openai', master);
		expect(first).not.toBe(second);
		expect(first).not.toContain(secret);
		expect(decryptApiKey(first, 'openai', master)).toBe(secret);
	});

	it('binds ciphertext to the provider and encryption key', () => {
		const cipher = encryptApiKey(secret, 'openrouter', master);
		expect(() => decryptApiKey(cipher, 'openai', master)).toThrow('ai_secret_invalid');
		expect(() =>
			decryptApiKey(cipher, 'openrouter', Buffer.alloc(32, 8).toString('base64'))
		).toThrow('ai_secret_invalid');
	});

	it('rejects tampering and unrecognised envelopes', () => {
		const cipher = encryptApiKey(secret, 'openai', master);
		const parts = cipher.split('.');
		parts[3] = (parts[3][0] === 'a' ? 'b' : 'a') + parts[3].slice(1);
		expect(() => decryptApiKey(parts.join('.'), 'openai', master)).toThrow('ai_secret_invalid');
		expect(() => decryptApiKey(cipher.replace('v1.', 'v2.'), 'openai', master)).toThrow(
			'ai_secret_invalid'
		);
		expect(() => decryptApiKey('malformed', 'openai', master)).toThrow('ai_secret_invalid');
	});

	it('requires an exact canonical 32-byte base64 deployment secret', () => {
		expect(encryptionReady(master)).toBe(true);
		expect(encryptionReady('')).toBe(false);
		expect(encryptionReady(Buffer.alloc(31).toString('base64'))).toBe(false);
		expect(encryptionReady(`${master}\n`)).toBe(false);
		expect(() => encryptApiKey(secret, 'openai', 'bad')).toThrow('ai_encryption_unavailable');
	});

	it('rejects header injection, invalid or excessively long API key values', () => {
		expect(validateApiKey(` ${secret} `)).toBe(secret);
		expect(() => validateApiKey(`${secret}\r\nInjected: yes`)).toThrow('ai_invalid_input');
		expect(() => validateApiKey('short')).toThrow('ai_invalid_input');
		expect(() => validateApiKey('x'.repeat(513))).toThrow('ai_invalid_input');
	});
});
