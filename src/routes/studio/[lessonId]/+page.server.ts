import { error, fail } from '@sveltejs/kit';
import { requireRole } from '#lib/server/auth';
import { readBoundedForm } from '#lib/server/http';
import {
	parseLessonForm,
	getEditorSnapshot,
	editTimestampSchema,
	learningError
} from '#lib/server/lesson-editor';
import { uuid } from '#lib/validation';
import type { Actions, PageServerLoad } from './$types';

const staff = ['teacher', 'admin', 'root_admin'] as const;
export const load: PageServerLoad = async (event) => {
	const { supabase, user, role } = requireRole(event, staff);
	if (!uuid.safeParse(event.params.lessonId).success) error(404, 'not_found');
	const snapshot = await getEditorSnapshot(supabase, event.params.lessonId);
	if (role === 'teacher' && snapshot.lesson.author_id !== user.id) error(404, 'not_found');
	return snapshot;
};
export const actions: Actions = {
	default: async (event) => {
		const { supabase } = requireRole(event, staff);
		const form = await readBoundedForm(event.request, 1_500_000);
		const { parsed, values } = parseLessonForm(form);
		const expected = editTimestampSchema.safeParse(form.get('updated_at'));
		if (!parsed.success || !expected.success || !uuid.safeParse(event.params.lessonId).success)
			return fail(400, { error: 'invalid_input', values });
		const { data, error: mutationError } = await supabase.rpc('save_lesson', {
			p_lesson_id: event.params.lessonId,
			p_content: parsed.data,
			p_expected_updated_at: expected.data
		});
		if (mutationError || !data)
			return fail(mutationError?.message === 'lesson_conflict' ? 409 : 400, {
				error: learningError(mutationError),
				values
			});
		return { success: true, message: 'lesson_updated' };
	}
};
