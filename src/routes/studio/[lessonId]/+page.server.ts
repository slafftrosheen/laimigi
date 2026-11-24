import { error, fail } from '@sveltejs/kit';
import { requireRole } from '#lib/server/auth';
import { readBoundedForm } from '#lib/server/http';
import { lessonSchema, uuid } from '#lib/validation';
import type { Lesson } from '#lib/types';
import type { Actions, PageServerLoad } from './$types';

const staff = ['teacher', 'admin', 'root_admin'] as const;
export const load: PageServerLoad = async (event) => {
	const { supabase, user, role } = requireRole(event, staff);
	if (!uuid.safeParse(event.params.lessonId).success) error(404, { message: 'not_found' });
	const { data: lesson } = await supabase
		.from('lessons')
		.select('*')
		.eq('id', event.params.lessonId)
		.maybeSingle<Lesson>();
	if (!lesson || (role === 'teacher' && lesson.author_id !== user.id))
		error(404, { message: 'not_found' });
	return { lesson };
};
export const actions: Actions = {
	default: async (event) => {
		const { supabase } = requireRole(event, staff);
		const form = await readBoundedForm(event.request);
		const parsed = lessonSchema.safeParse(Object.fromEntries(form));
		if (!parsed.success || !uuid.safeParse(event.params.lessonId).success)
			return fail(400, { error: 'invalid_input' });
		const status = form.get('status') === 'published' ? 'published' : 'draft';
		const { data, error: mutationError } = await supabase
			.from('lessons')
			.update({ ...parsed.data, status })
			.eq('id', event.params.lessonId)
			.select('id')
			.maybeSingle<{ id: string }>();
		if (mutationError || !data) return fail(400, { error: 'save_failed' });
		return { success: true, message: 'lesson_updated' };
	}
};
