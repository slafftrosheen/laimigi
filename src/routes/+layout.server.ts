import type { LayoutServerLoad } from './$types';
export const load: LayoutServerLoad = ({ locals }) => ({
	locale: locals.locale,
	user: locals.user && !locals.childMode ? { id: locals.user.id, email: locals.user.email } : null,
	role: locals.childMode ? null : locals.role,
	configured: locals.configured,
	childMode: locals.childMode
});
