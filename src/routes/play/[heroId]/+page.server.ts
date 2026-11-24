import { error } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth';
import { uuid } from '#lib/validation';
import type { ChildProfile, Lesson, LessonProgress } from '#lib/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { supabase } = requireUser(event);
	if (!uuid.safeParse(event.params.heroId).success) error(404, { message: 'not_found' });
	const { data: hero } = await supabase
		.from('child_profiles')
		.select('id,family_id,nickname,age_band,avatar,locale')
		.eq('id', event.params.heroId)
		.maybeSingle<ChildProfile>();
	if (!hero) error(404, { message: 'not_found' });
	const [lessonResult, progressResult] = await Promise.all([
		supabase
			.from('lessons')
			.select('*')
			.eq('status', 'published')
			.eq('locale', hero.locale)
			.eq('age_band', hero.age_band)
			.order('created_at', { ascending: false }),
		supabase
			.from('lesson_progress')
			.select('child_profile_id,lesson_id,status,completed_at')
			.eq('child_profile_id', hero.id)
	]);
	if (lessonResult.error || progressResult.error) error(503, { message: 'database_unavailable' });
	return {
		hero,
		lessons: (lessonResult.data ?? []) as Lesson[],
		progress: (progressResult.data ?? []) as LessonProgress[]
	};
};
