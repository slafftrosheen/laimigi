import { error, fail } from '@sveltejs/kit';
import { z } from 'zod';
import { requireUser } from '#lib/server/auth';
import {
	getFamily,
	getHero,
	getHeroes,
	getRewards,
	PROGRESS_COLUMNS,
	BLOCK_PROGRESS_COLUMNS
} from '#lib/server/content';
import { readBoundedForm } from '#lib/server/http';
import { learningError } from '#lib/server/lesson-editor';
import { uuid } from '#lib/validation';
import type { Lesson, LessonProgress, BlockProgress } from '#lib/types';
import type { Actions, PageServerLoad } from './$types';

const submission = z.object({
	hero_id: uuid,
	content_version: z.coerce.number().int().min(1).max(2_000_000_000)
});
const stepSubmission = submission.extend({ block_id: uuid, option_id: uuid.nullable() });
const stepResultSchema = z.object({
	correct: z.boolean(),
	completed: z.boolean(),
	completed_count: z.number().int().min(0).max(12),
	total_blocks: z.number().int().min(0).max(12)
});

export const load: PageServerLoad = async (event) => {
	const { supabase, user } = requireUser(event);
	if (!uuid.safeParse(event.params.lessonId).success) error(404, 'not_found');
	const { data: lesson, error: queryError } = await supabase
		.from('lessons')
		.select('*')
		.eq('id', event.params.lessonId)
		.eq('status', 'published')
		.maybeSingle<Lesson>();
	if (queryError) error(503, 'database_unavailable');
	if (!lesson) error(404, 'not_found');
	const mode = event.locals.childMode;
	let heroes;
	if (mode) {
		const hero = await getHero(supabase, mode.heroId);
		if (hero.age_band !== lesson.age_band || hero.locale !== lesson.locale) error(404, 'not_found');
		heroes = [hero];
	} else {
		const family = await getFamily(supabase, user.id);
		heroes = (await getHeroes(supabase, family.id)).filter(
			(hero) => hero.age_band === lesson.age_band && hero.locale === lesson.locale
		);
	}
	const requestedHero = event.url.searchParams.get('hero');
	if (requestedHero && !heroes.some((hero) => hero.id === requestedHero)) error(404, 'not_found');
	const activeHeroId = mode?.heroId ?? requestedHero ?? heroes[0]?.id ?? null;
	const heroIds = heroes.map((hero) => hero.id);
	if (!heroIds.length)
		return {
			lesson,
			heroes,
			activeHeroId,
			progress: [] as LessonProgress[],
			blockProgress: [] as BlockProgress[],
			rewards: []
		};
	const [progress, blockProgress, rewards] = await Promise.all([
		supabase
			.from('lesson_progress')
			.select(PROGRESS_COLUMNS)
			.eq('lesson_id', lesson.id)
			.in('child_profile_id', heroIds),
		supabase
			.from('lesson_block_progress')
			.select(BLOCK_PROGRESS_COLUMNS)
			.eq('lesson_id', lesson.id)
			.eq('content_version', lesson.content_version)
			.in('child_profile_id', heroIds),
		getRewards(supabase, heroIds)
	]);
	if (progress.error || blockProgress.error) error(503, 'database_unavailable');
	return {
		lesson,
		heroes,
		activeHeroId,
		progress: (progress.data ?? []) as LessonProgress[],
		blockProgress: (blockProgress.data ?? []) as BlockProgress[],
		rewards
	};
};

export const actions: Actions = {
	step: async (event) => {
		const { supabase } = requireUser(event);
		const form = await readBoundedForm(event.request, 4_000);
		const parsed = stepSubmission.safeParse({
			...Object.fromEntries(form),
			option_id: form.get('option_id') || null
		});
		if (!parsed.success || !uuid.safeParse(event.params.lessonId).success)
			return fail(400, { error: 'invalid_input' });
		if (event.locals.childMode && event.locals.childMode.heroId !== parsed.data.hero_id)
			return fail(403, { error: 'forbidden' });
		const { hero_id, block_id, option_id, content_version } = parsed.data;
		const { data, error: mutationError } = await supabase.rpc('submit_lesson_block', {
			p_child_profile_id: hero_id,
			p_lesson_id: event.params.lessonId,
			p_block_id: block_id,
			p_option_id: option_id,
			p_content_version: content_version
		});
		if (mutationError)
			return fail(400, { error: learningError(mutationError), values: parsed.data });
		const result = stepResultSchema.safeParse(data);
		if (!result.success) return fail(503, { error: 'save_failed', values: parsed.data });
		return {
			success: true,
			message: result.data.correct ? 'step_saved' : 'answer_incorrect',
			stepResult: result.data,
			block_id,
			hero_id
		};
	},
	complete: async (event) => {
		const { supabase } = requireUser(event);
		const parsed = submission.safeParse(
			Object.fromEntries(await readBoundedForm(event.request, 4_000))
		);
		if (!parsed.success || !uuid.safeParse(event.params.lessonId).success)
			return fail(400, { error: 'invalid_input' });
		if (event.locals.childMode && event.locals.childMode.heroId !== parsed.data.hero_id)
			return fail(403, { error: 'forbidden' });
		const { error: mutationError } = await supabase.rpc('complete_lesson_revision', {
			p_child_profile_id: parsed.data.hero_id,
			p_lesson_id: event.params.lessonId,
			p_content_version: parsed.data.content_version
		});
		if (mutationError)
			return fail(400, { error: learningError(mutationError), values: parsed.data });
		return { success: true, message: 'lesson_completed' };
	}
};
