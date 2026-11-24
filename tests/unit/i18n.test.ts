import { describe, expect, it } from 'vitest';
import { getMessages, isLocale, locales } from '#lib/i18n/index';

describe('three complete interface languages', () => {
	it('defaults to Latvian for unknown locale values', () => {
		expect(getMessages('unknown')).toEqual(getMessages('lv'));
		expect(isLocale('uk')).toBe(false);
	});
	it.each(locales)('%s has every message and no empty translations', (locale) => {
		const dictionary = getMessages(locale);
		expect(Object.keys(dictionary).sort()).toEqual(Object.keys(getMessages('en')).sort());
		expect(
			Object.values(dictionary).every(
				(message) => typeof message === 'string' && message.trim().length > 0
			)
		).toBe(true);
	});
});
