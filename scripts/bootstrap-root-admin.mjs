import { createClient } from '@supabase/supabase-js';

// Run with: node --env-file=.env.local scripts/bootstrap-root-admin.mjs --email you@example.com
// The account must already exist and have a verified email address.
const emailFlag = process.argv.indexOf('--email');
const email = emailFlag >= 0 ? process.argv[emailFlag + 1] : process.env.ROOT_ADMIN_EMAIL;
const url = process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
	console.error('Provide the verified adult account using --email or ROOT_ADMIN_EMAIL.');
	process.exitCode = 1;
} else if (!url || !secret) {
	console.error('A Supabase URL and server-only SUPABASE_SERVICE_ROLE_KEY are required.');
	process.exitCode = 1;
} else {
	try {
		const client = createClient(url, secret, {
			auth: { autoRefreshToken: false, persistSession: false }
		});
		const { error } = await client.rpc('bootstrap_root_admin', { p_email: email });
		if (error) {
			// Avoid printing SDK request objects, headers or raw upstream errors.
			const messages = {
				22023: 'Create and verify the adult account first, and apply the migration.',
				42501: 'Bootstrap is unavailable. A root administrator may already exist.'
			};
			console.error(
				messages[error.code] || 'Root bootstrap failed. Check migration and project credentials.'
			);
			process.exitCode = 1;
		} else {
			console.log('Root administrator confirmed. Sign out, then sign back in to the portal.');
		}
	} catch {
		console.error('Could not reach the Supabase project. No credentials were printed.');
		process.exitCode = 1;
	}
}
