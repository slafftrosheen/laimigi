import { error, fail, redirect } from '@sveltejs/kit';
import { requireRole } from '#lib/server/auth';
import { readBoundedForm } from '#lib/server/http';
import { uuid } from '#lib/validation';
import { parseLessonForm, getEditorSnapshot } from '#lib/server/lesson-editor';
import type { Lesson } from '#lib/types';
import type { Actions, PageServerLoad } from './$types';

const staff = ['teacher', 'admin', 'root_admin'] as const;
export const load: PageServerLoad = async (event) => {
	const { supabase, user, role } = requireRole(event, staff);
	let query = supabase
		.from('lessons')
		.select('*')
		.order('updated_at', { ascending: false })
		.limit(100);
	if (role === 'teacher') query = query.eq('author_id', user.id);
	const { data, error: queryError } = await query;
	if (queryError) error(503, 'database_unavailable');
	return { lessons: (data ?? []) as Lesson[] };
};
export const actions: Actions = {
	create: async (event) => {
		const { supabase } = requireRole(event, staff);
		const { parsed, values } = parseLessonForm(await readBoundedForm(event.request, 1_500_000));
		if (!parsed.success) return fail(400, { error: 'invalid_input', values });
		const { data, error: mutationError } = await supabase.rpc('save_lesson', {
			p_lesson_id: null,
			p_content: { ...parsed.data, status: 'draft' }
		});
		if (mutationError || !uuid.safeParse(data).success)
			return fail(400, { error: 'save_failed', values });
		redirect(303, `/studio/${data}`);
	},
	duplicate: async (event) => {
		const { supabase, user, role } = requireRole(event, staff);
		const form = await readBoundedForm(event.request, 4_000);
		const id = uuid.safeParse(form.get('lesson_id'));
		if (!id.success) return fail(400, { error: 'invalid_input' });
		const { lesson, authorBlocks } = await getEditorSnapshot(supabase, id.data);
		if (role === 'teacher' && lesson.author_id !== user.id)
			return fail(403, { error: 'forbidden' });
		const prefix = { lv: 'Kopija: ', ru: 'Копия: ', en: 'Copy: ' }[lesson.locale];
		const { data, error: mutationError } = await supabase.rpc('save_lesson', {
			p_lesson_id: null,
			p_content: {
				title: `${prefix}${lesson.title}`.slice(0, 120),
				description: lesson.description,
				body: lesson.body,
				locale: lesson.locale,
				age_band: lesson.age_band,
				location: lesson.location,
				status: 'draft',
				blocks: authorBlocks
			}
		});
		if (mutationError || !uuid.safeParse(data).success) return fail(400, { error: 'save_failed' });
		redirect(303, `/studio/${data}`);
	},
	publish: async (event) => {
		const { supabase } = requireRole(event, staff);
		const form = await readBoundedForm(event.request, 4_000);
		const id = uuid.safeParse(form.get('lesson_id'));
		if (!id.success) return fail(400, { error: 'invalid_input' });
		const { data, error: mutationError } = await supabase
			.from('lessons')
			.update({ status: 'published' })
			.eq('id', id.data)
			.select('id')
			.maybeSingle<{ id: string }>();
		if (mutationError || !data) return fail(400, { error: 'save_failed' });
		return { success: true, message: 'lesson_published' };
	},
	delete: async (event) => {
		const { supabase } = requireRole(event, staff);
		const form = await readBoundedForm(event.request, 4_000);
		const id = uuid.safeParse(form.get('lesson_id'));
		if (!id.success) return fail(400, { error: 'invalid_input' });
		const { data, error: mutationError } = await supabase
			.from('lessons')
			.delete()
			.eq('id', id.data)
			.select('id')
			.maybeSingle<{ id: string }>();
		if (mutationError || !data) return fail(400, { error: 'delete_failed' });
		return { success: true, message: 'lesson_removed' };
	}
};
