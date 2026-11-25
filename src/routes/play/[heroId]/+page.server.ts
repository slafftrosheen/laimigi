import { error, redirect } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth';
import { getHero, getRewards, PROGRESS_COLUMNS } from '#lib/server/content';
import { uuid } from '#lib/validation';
import type { Lesson, LessonProgress } from '#lib/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { supabase } = requireUser(event);
	if (!event.locals.childMode) redirect(303, '/family');
	if (!uuid.safeParse(event.params.heroId).success) error(404, 'not_found');
	if (event.locals.childMode.heroId !== event.params.heroId) error(403, 'forbidden');
	const hero = await getHero(supabase, event.params.heroId);
	const [lessonResult, progressResult] = await Promise.all([
		supabase
			.from('lessons')
			.select('*')
			.eq('status', 'published')
			.eq('locale', hero.locale)
			.eq('age_band', hero.age_band)
			.order('created_at', { ascending: false }),
		supabase.from('lesson_progress').select(PROGRESS_COLUMNS).eq('child_profile_id', hero.id)
	]);
	if (lessonResult.error || progressResult.error) error(503, 'database_unavailable');
	return {
		hero,
		lessons: (lessonResult.data ?? []) as Lesson[],
		progress: (progressResult.data ?? []) as LessonProgress[],
		rewards: await getRewards(supabase, [hero.id])
	};
};
