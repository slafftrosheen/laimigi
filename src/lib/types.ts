export const APP_ROLES = ['parent', 'teacher', 'admin', 'root_admin'] as const;
export type AppRole = (typeof APP_ROLES)[number];
export const LOCALES = ['lv', 'ru', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const AGE_BANDS = ['4-6', '7-9', '10-12'] as const;
export type AgeBand = (typeof AGE_BANDS)[number];
export const AVATARS = ['leaf', 'compass', 'crystal'] as const;
export const LOCATIONS = [
	'school',
	'observatory',
	'workshop',
	'library',
	'garden',
	'tree'
] as const;
export type WorldLocation = (typeof LOCATIONS)[number];

export interface Family {
	id: string;
	owner_id: string;
	name: string;
}
export interface ChildProfile {
	id: string;
	family_id: string;
	nickname: string;
	age_band: AgeBand;
	avatar: (typeof AVATARS)[number];
	locale: Locale;
}
export interface Lesson {
	id: string;
	author_id: string;
	title: string;
	description: string;
	body: string;
	locale: Locale;
	age_band: AgeBand;
	location: WorldLocation;
	status: 'draft' | 'published';
	created_at: string;
	updated_at: string;
}
export interface LessonProgress {
	child_profile_id: string;
	lesson_id: string;
	status: string;
	completed_at: string | null;
}
