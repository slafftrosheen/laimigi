import { error, fail } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth';
import { getFamily, getHeroes } from '#lib/server/content';
import { readBoundedForm } from '#lib/server/http';
import { uuid } from '#lib/validation';
import type { Lesson, LessonProgress } from '#lib/types';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { supabase, user } = requireUser(event);
	if (!uuid.safeParse(event.params.lessonId).success) error(404, { message: 'not_found' });
	const { data: lesson } = await supabase
		.from('lessons')
		.select('*')
		.eq('id', event.params.lessonId)
		.eq('status', 'published')
		.maybeSingle<Lesson>();
	if (!lesson) error(404, { message: 'not_found' });
	const family = await getFamily(supabase, user.id);
	const heroes = (await getHeroes(supabase, family.id)).filter(
		(hero) => hero.age_band === lesson.age_band
	);
	const { data: progress } = await supabase
		.from('lesson_progress')
		.select('child_profile_id,lesson_id,status,completed_at')
		.eq('lesson_id', lesson.id);
	return { lesson, heroes, progress: (progress ?? []) as LessonProgress[] };
};
export const actions: Actions = {
	complete: async (event) => {
		const { supabase } = requireUser(event);
		const form = await readBoundedForm(event.request, 4_000);
		const childId = uuid.safeParse(form.get('hero_id'));
		if (!childId.success || !uuid.safeParse(event.params.lessonId).success)
			return fail(400, { error: 'invalid_input' });
		const { error: mutationError } = await supabase.rpc('complete_lesson', {
			p_child_profile_id: childId.data,
			p_lesson_id: event.params.lessonId
		});
		if (mutationError) return fail(400, { error: 'save_failed' });
		return { success: true, message: 'lesson_completed' };
	}
};
