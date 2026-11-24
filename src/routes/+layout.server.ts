import type { LayoutServerLoad } from './$types';
export const load: LayoutServerLoad = ({ locals }) => ({
	locale: locals.locale,
	user: locals.user ? { id: locals.user.id, email: locals.user.email } : null,
	role: locals.role,
	configured: locals.configured
});
