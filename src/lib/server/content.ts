import { error } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Family, ChildProfile } from '#lib/types';

export async function getFamily(supabase: SupabaseClient, userId: string): Promise<Family> {
	const { data, error: queryError } = await supabase
		.from('families')
		.select('id,owner_id,name')
		.eq('owner_id', userId)
		.maybeSingle<Family>();
	if (queryError || !data) error(503, { message: 'database_unavailable' });
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
	if (queryError) error(503, { message: 'database_unavailable' });
	return (data ?? []) as ChildProfile[];
}
