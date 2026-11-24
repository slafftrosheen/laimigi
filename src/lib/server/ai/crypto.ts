import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { AiError, type AiProvider } from './types';

const VERSION = 'v1';
const MAX_CIPHERTEXT_LENGTH = 1200;

function masterKey(value: string | undefined): Buffer {
	if (!value || !/^[A-Za-z0-9+/]{43}=$/.test(value)) {
		throw new AiError('ai_encryption_unavailable');
	}
	const key = Buffer.from(value, 'base64');
	if (key.length !== 32 || key.toString('base64') !== value) {
		throw new AiError('ai_encryption_unavailable');
	}
	return key;
}

export function encryptionReady(value: string | undefined): boolean {
	try {
		masterKey(value);
		return true;
	} catch {
		return false;
	}
}

export function validateApiKey(value: unknown): string {
	if (typeof value !== 'string') throw new AiError('ai_invalid_input', 400);
	const key = value.trim();
	if (key.length < 20 || key.length > 512 || !/^[\x21-\x7e]+$/.test(key)) {
		throw new AiError('ai_invalid_input', 400);
	}
	return key;
}

function aad(provider: AiProvider): Buffer {
	return Buffer.from(`laimigi:ai-provider:${VERSION}:${provider}`, 'utf8');
}

/** The master key belongs in deployment secrets, never in Supabase or the client bundle. */
export function encryptApiKey(
	value: string,
	provider: AiProvider,
	master: string | undefined
): string {
	const key = masterKey(master);
	const secret = validateApiKey(value);
	const nonce = randomBytes(12);
	const cipher = createCipheriv('aes-256-gcm', key, nonce);
	cipher.setAAD(aad(provider));
	const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
	return [
		VERSION,
		nonce.toString('base64url'),
		cipher.getAuthTag().toString('base64url'),
		encrypted.toString('base64url')
	].join('.');
}

export function decryptApiKey(
	ciphertext: string,
	provider: AiProvider,
	master: string | undefined
): string {
	const key = masterKey(master);
	try {
		if (typeof ciphertext !== 'string' || ciphertext.length > MAX_CIPHERTEXT_LENGTH) {
			throw new Error('Invalid envelope');
		}
		const parts = ciphertext.split('.');
		if (
			parts.length !== 4 ||
			parts[0] !== VERSION ||
			parts.slice(1).some((part) => !/^[A-Za-z0-9_-]+$/.test(part))
		) {
			throw new Error('Invalid envelope');
		}
		const [, noncePart, tagPart, dataPart] = parts;
		const nonce = Buffer.from(noncePart, 'base64url');
		const tag = Buffer.from(tagPart, 'base64url');
		const encrypted = Buffer.from(dataPart, 'base64url');
		if (
			nonce.length !== 12 ||
			tag.length !== 16 ||
			encrypted.length < 20 ||
			encrypted.length > 512 ||
			nonce.toString('base64url') !== noncePart ||
			tag.toString('base64url') !== tagPart ||
			encrypted.toString('base64url') !== dataPart
		) {
			throw new Error('Invalid envelope');
		}
		const decipher = createDecipheriv('aes-256-gcm', key, nonce);
		decipher.setAAD(aad(provider));
		decipher.setAuthTag(tag);
		return validateApiKey(
			Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
		);
	} catch {
		// Authentication failures never include the envelope, key or crypto library details.
		throw new AiError('ai_secret_invalid');
	}
}
