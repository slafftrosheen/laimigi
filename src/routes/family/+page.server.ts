import { error, fail } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth';
import { getFamily, getHeroes, getRewards, PROGRESS_COLUMNS } from '#lib/server/content';
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
			.select(PROGRESS_COLUMNS)
			.in(
				'child_profile_id',
				heroes.map((hero) => hero.id)
			);
		if (queryError) error(503, 'database_unavailable');
		progress = (data ?? []) as LessonProgress[];
	}
	const rewards = await getRewards(
		supabase,
		heroes.map((hero) => hero.id)
	);
	return { family, heroes, progress, rewards };
};
export const actions: Actions = {
	createHero: async (event) => {
		const { supabase, user } = requireUser(event);
		const family = await getFamily(supabase, user.id);
		const form = await readBoundedForm(event.request, 8_000);
		const parsed = heroSchema.safeParse(Object.fromEntries(form));
		const values = heroValues(form);
		if (!parsed.success) return fail(400, { error: 'invalid_input', values });
		const { error: mutationError } = await supabase
			.from('child_profiles')
			.insert({ ...parsed.data, family_id: family.id });
		if (mutationError) return fail(400, { error: 'save_failed', values });
		return { success: true, message: 'hero_created' };
	},
	updateHero: async (event) => {
		const { supabase, user } = requireUser(event);
		const family = await getFamily(supabase, user.id);
		const form = await readBoundedForm(event.request, 8_000);
		const id = uuid.safeParse(form.get('hero_id'));
		const parsed = heroSchema.safeParse(Object.fromEntries(form));
		const values = heroValues(form);
		if (!id.success || !parsed.success) return fail(400, { error: 'invalid_input', values });
		const { data, error: mutationError } = await supabase
			.from('child_profiles')
			.update(parsed.data)
			.eq('id', id.data)
			.eq('family_id', family.id)
			.select('id')
			.maybeSingle<{ id: string }>();
		if (mutationError || !data) return fail(400, { error: 'save_failed', values });
		return { success: true, message: 'hero_updated' };
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

function heroValues(form: FormData) {
	return {
		hero_id: String(form.get('hero_id') ?? '').slice(0, 36),
		nickname: String(form.get('nickname') ?? '').slice(0, 32),
		age_band: String(form.get('age_band') ?? '').slice(0, 5),
		avatar: String(form.get('avatar') ?? '').slice(0, 12),
		locale: String(form.get('locale') ?? '').slice(0, 2)
	};
}
