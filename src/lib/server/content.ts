import { error } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Family, ChildProfile, HeroReward } from '#lib/types';

export const PROGRESS_COLUMNS =
	'child_profile_id,lesson_id,status,completed_at,last_step,content_version,updated_at';
export const BLOCK_PROGRESS_COLUMNS =
	'child_profile_id,lesson_id,block_id,content_version,completed_at';

export async function getFamily(supabase: SupabaseClient, userId: string): Promise<Family> {
	const { data, error: queryError } = await supabase
		.from('families')
		.select('id,owner_id,name')
		.eq('owner_id', userId)
		.maybeSingle<Family>();
	if (queryError || !data) error(503, 'database_unavailable');
	return data;
}
export async function getHeroes(
	supabase: SupabaseClient,
	familyId: string
): Promise<ChildProfile[]> {
	const { data, error: queryError } = await supabase
		.from('child_profiles')
		.select('id,family_id,nickname,age_band,avatar,locale')
		.eq('family_id', familyId)
		.order('created_at');
	if (queryError) error(503, 'database_unavailable');
	return (data ?? []) as ChildProfile[];
}

export async function getHero(supabase: SupabaseClient, heroId: string): Promise<ChildProfile> {
	const { data, error: queryError } = await supabase
		.from('child_profiles')
		.select('id,family_id,nickname,age_band,avatar,locale')
		.eq('id', heroId)
		.maybeSingle<ChildProfile>();
	if (queryError) error(503, 'database_unavailable');
	if (!data) error(404, 'not_found');
	return data;
}

export async function getRewards(
	supabase: SupabaseClient,
	heroIds: string[]
): Promise<HeroReward[]> {
	if (!heroIds.length) return [];
	const rewards = new Map<string, HeroReward>();
	// Page the immutable ledger so Supabase's response cap cannot truncate XP.
	for (let offset = 0; ; offset += 500) {
		const { data, error: queryError } = await supabase
			.from('hero_rewards')
			.select('child_profile_id,lesson_id,location,xp,earned_at')
			.in('child_profile_id', heroIds)
			.order('earned_at')
			.order('child_profile_id')
			.order('lesson_id')
			.range(offset, offset + 499);
		if (queryError) error(503, 'database_unavailable');
		const rows = (data ?? []) as HeroReward[];
		for (const row of rows) rewards.set(`${row.child_profile_id}:${row.lesson_id}`, row);
		if (rows.length < 500) return [...rewards.values()];
	}
}
