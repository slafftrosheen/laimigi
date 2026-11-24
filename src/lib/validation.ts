import { z } from 'zod';
import { AGE_BANDS, AVATARS, LOCALES, LOCATIONS } from '#lib/types';

export const uuid = z.uuid();
export const loginSchema = z.object({
	email: z
		.email()
		.max(254)
		.transform((email) => email.trim().toLowerCase()),
	password: z.string().min(8).max(128)
});
export const signupSchema = loginSchema.extend({
	password: z.string().min(12).max(128),
	adult: z.literal('yes')
});
export const heroSchema = z.object({
	nickname: z.string().trim().min(2).max(32),
	age_band: z.enum(AGE_BANDS),
	avatar: z.enum(AVATARS),
	locale: z.enum(LOCALES)
});
export const lessonSchema = z.object({
	title: z.string().trim().min(3).max(120),
	description: z.string().trim().max(400),
	body: z.string().trim().min(10).max(20_000),
	locale: z.enum(LOCALES),
	age_band: z.enum(AGE_BANDS),
	location: z.enum(LOCATIONS)
});
