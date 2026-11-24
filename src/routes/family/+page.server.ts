import { error, fail } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth';
import { getFamily, getHeroes } from '#lib/server/content';
import { readBoundedForm } from '#lib/server/http';
import { heroSchema, uuid } from '#lib/validation';
import type { Actions, PageServerLoad } from './$types';
import type { LessonProgress } from '#lib/types';

export const load: PageServerLoad = async (event) => {
	const { supabase, user } = requireUser(event);
	const family = await getFamily(supabase, user.id);
	const heroes = await getHeroes(supabase, family.id);
	let progress: LessonProgress[] = [];
	if (heroes.length) {
		const { data, error: queryError } = await supabase
			.from('lesson_progress')
			.select('child_profile_id,lesson_id,status,completed_at')
			.in(
				'child_profile_id',
				heroes.map((hero) => hero.id)
			);
		if (queryError) error(503, { message: 'database_unavailable' });
		progress = (data ?? []) as LessonProgress[];
	}
	return { family, heroes, sessions: [], progress };
};
export const actions: Actions = {
	createHero: async (event) => {
		const { supabase, user } = requireUser(event);
		const family = await getFamily(supabase, user.id);
		const parsed = heroSchema.safeParse(
			Object.fromEntries(await readBoundedForm(event.request, 8_000))
		);
		if (!parsed.success) return fail(400, { error: 'invalid_input' });
		const { error: mutationError } = await supabase
			.from('child_profiles')
			.insert({ ...parsed.data, family_id: family.id });
		if (mutationError) return fail(400, { error: 'save_failed' });
		return { success: true, message: 'hero_created' };
	},
	removeHero: async (event) => {
		const { supabase, user } = requireUser(event);
		const family = await getFamily(supabase, user.id);
		const form = await readBoundedForm(event.request, 4_000);
		const id = uuid.safeParse(form.get('hero_id'));
		if (!id.success) return fail(400, { error: 'invalid_input' });
		const { data, error: mutationError } = await supabase
			.from('child_profiles')
			.delete()
			.eq('id', id.data)
			.eq('family_id', family.id)
			.select('id')
			.maybeSingle<{ id: string }>();
		if (mutationError || !data) return fail(400, { error: 'delete_failed' });
		return { success: true, message: 'hero_removed' };
	}
};
