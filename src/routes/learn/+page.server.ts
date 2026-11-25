import { error } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth';
import {
	LOCALES,
	AGE_BANDS,
	LOCATIONS,
	type Locale,
	type AgeBand,
	type WorldLocation,
	type Lesson
} from '#lib/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { supabase } = requireUser(event);
	const requestedLanguage = event.url.searchParams.get('language') as Locale;
	const language = LOCALES.includes(requestedLanguage) ? requestedLanguage : event.locals.locale;
	const requestedAge = event.url.searchParams.get('age_band') as AgeBand;
	const age_band = AGE_BANDS.includes(requestedAge) ? requestedAge : 'all';
	const requestedLocation = event.url.searchParams.get('location') as WorldLocation;
	const location = LOCATIONS.includes(requestedLocation) ? requestedLocation : 'all';
	let query = supabase
		.from('lessons')
		.select('*')
		.eq('status', 'published')
		.eq('locale', language)
		.order('created_at', { ascending: false })
		.limit(100);
	if (age_band !== 'all') query = query.eq('age_band', age_band);
	if (location !== 'all') query = query.eq('location', location);
	const { data, error: queryError } = await query;
	if (queryError) error(503, 'database_unavailable');
	return { lessons: (data ?? []) as Lesson[], filters: { language, age_band, location } };
};
