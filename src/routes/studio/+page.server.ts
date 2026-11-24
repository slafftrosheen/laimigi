import { error, fail } from '@sveltejs/kit';
import { requireRole } from '#lib/server/auth';
import { readBoundedForm } from '#lib/server/http';
import { lessonSchema, uuid } from '#lib/validation';
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
	if (queryError) error(503, { message: 'database_unavailable' });
	return { lessons: (data ?? []) as Lesson[] };
};
export const actions: Actions = {
	create: async (event) => {
		const { supabase, user } = requireRole(event, staff);
		const parsed = lessonSchema.safeParse(Object.fromEntries(await readBoundedForm(event.request)));
		if (!parsed.success) return fail(400, { error: 'invalid_input' });
		const { error: mutationError } = await supabase
			.from('lessons')
			.insert({ ...parsed.data, author_id: user.id, status: 'draft' });
		if (mutationError) return fail(400, { error: 'save_failed' });
		return { success: true, message: 'lesson_created' };
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
