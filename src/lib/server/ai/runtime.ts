import * as privateEnv from '$app/env/private';

/** Resolve through SvelteKit so Vite .env.local and deployment secrets behave identically. */
export function getEncryptionKey(): string | undefined {
	return privateEnv.AI_SETTINGS_ENCRYPTION_KEY;
}
