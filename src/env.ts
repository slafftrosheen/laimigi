import { defineEnvVars } from '@sveltejs/kit/env';

const optional = (value: string | undefined) => value?.trim() || undefined;

// A fresh checkout can render the public UI without service credentials.
// Protected functionality fails closed until its required variables are configured.
export const variables = defineEnvVars({
	PUBLIC_SUPABASE_URL: { public: true, schema: optional },
	PUBLIC_SUPABASE_PUBLISHABLE_KEY: { public: true, schema: optional },
	PUBLIC_SUPABASE_ANON_KEY: { public: true, schema: optional },
	SUPABASE_SECRET_KEY: { schema: optional },
	SUPABASE_SERVICE_ROLE_KEY: { schema: optional },
	AI_SETTINGS_ENCRYPTION_KEY: { schema: optional }
});
