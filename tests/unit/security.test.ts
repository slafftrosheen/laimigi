import { describe, expect, it } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { requireRoot, requireRole, safeNext } from '#lib/server/auth';
import { assertSameOrigin, readBoundedForm } from '#lib/server/http';
import type { AppRole } from '#lib/types';
import { heroSchema, lessonSchema, signupSchema } from '#lib/validation';

function eventFor(role: AppRole | null, signedIn = true) {
	return {
		url: new URL('https://portal.example/admin'),
		locals: {
			user: signedIn ? ({ id: 'adult-id' } as User) : null,
			role,
			supabase: {} as SupabaseClient
		},
		request: new Request('https://portal.example/admin', {
			method: 'POST',
			headers: { Origin: 'https://portal.example' }
		})
	} as RequestEvent;
}

describe('authorization and redirects', () => {
	it.each(['parent', 'teacher', 'admin'] as const)(
		'rejects %s from root administration',
		(role) => {
			expect(() => requireRoot(eventFor(role))).toThrow();
		}
	);
	it('permits only explicit root role and rejects a missing role', () => {
		expect(requireRoot(eventFor('root_admin')).role).toBe('root_admin');
		expect(() => requireRoot(eventFor(null))).toThrow();
	});
	it('redirects unauthenticated callers to local login', () => {
		try {
			requireRole(eventFor(null, false), ['teacher']);
		} catch (result) {
			expect(result).toMatchObject({ status: 303, location: '/auth/login?next=%2Fadmin' });
		}
	});
	it.each([
		'https://bad.example',
		'//bad.example',
		'/\\bad.example',
		'/%2f%2fbad.example',
		'/%5cbad.example',
		'/%0aLocation:bad',
		'javascript:alert(1)',
		'/%ZZ'
	])('rejects unsafe next path %s', (value) => {
		expect(safeNext(value)).toBe('/family');
	});
	it('preserves a valid local path, query and fragment', () => {
		expect(safeNext('/learn?language=ru#materials')).toBe('/learn?language=ru#materials');
	});
});

describe('mutation request boundaries', () => {
	it('accepts a same-origin JSON mutation', () => {
		expect(() => assertSameOrigin(eventFor('teacher'))).not.toThrow();
	});
	it.each([undefined, 'null', 'https://attacker.example'])(
		'rejects missing or foreign Origin %s',
		(origin) => {
			const base = eventFor('teacher');
			const event = {
				...base,
				request: new Request(base.url, {
					method: 'POST',
					headers: origin ? { Origin: origin } : {}
				})
			} as RequestEvent;
			expect(() => assertSameOrigin(event)).toThrow();
		}
	);
	it('enforces the body limit without relying on Content-Length', async () => {
		const request = new Request('https://portal.example', {
			method: 'POST',
			body: new URLSearchParams({ value: 'x'.repeat(100) })
		});
		await expect(readBoundedForm(request, 30)).rejects.toMatchObject({ status: 413 });
	});
	it('parses bounded URL-encoded form fields', async () => {
		const form = await readBoundedForm(
			new Request('https://portal.example', {
				method: 'POST',
				body: new URLSearchParams({ nickname: 'Explorer' })
			})
		);
		expect(form.get('nickname')).toBe('Explorer');
	});
	it('rejects arbitrary content types', async () => {
		await expect(
			readBoundedForm(
				new Request('https://portal.example', {
					method: 'POST',
					body: '{}',
					headers: { 'Content-Type': 'application/json' }
				})
			)
		).rejects.toMatchObject({ status: 415 });
	});
});

describe('input contracts', () => {
	it('requires adult acknowledgement and a strong initial password', () => {
		expect(
			signupSchema.safeParse({ email: 'adult@example.test', password: 'short', adult: 'yes' })
				.success
		).toBe(false);
		expect(
			signupSchema.safeParse({ email: 'adult@example.test', password: 'long-fixture-password' })
				.success
		).toBe(false);
		expect(
			signupSchema.safeParse({
				email: 'adult@example.test',
				password: 'long-fixture-password',
				adult: 'yes',
				role: 'root_admin'
			}).success
		).toBe(true);
		const parsed = signupSchema.parse({
			email: 'adult@example.test',
			password: 'long-fixture-password',
			adult: 'yes',
			role: 'root_admin'
		});
		expect(parsed).not.toHaveProperty('role');
	});
	it('rejects unsupported hero ages and extra identity fields do not enter storage input', () => {
		expect(
			heroSchema.safeParse({
				nickname: 'Comet',
				age_band: '13-16',
				avatar: 'crystal',
				locale: 'en'
			}).success
		).toBe(false);
		const parsed = heroSchema.parse({
			nickname: 'Comet',
			age_band: '10-12',
			avatar: 'crystal',
			locale: 'en',
			full_name: 'Do not store',
			family_id: 'other-family'
		});
		expect(parsed).not.toHaveProperty('family_id');
		expect(parsed).not.toHaveProperty('full_name');
	});
	it('rejects oversized content and preserves text without treating it as HTML', () => {
		const content = {
			title: 'Question',
			description: '',
			body: '<script>alert(1)</script>',
			locale: 'lv',
			age_band: '7-9',
			location: 'school'
		};
		expect(lessonSchema.parse(content).body).toBe(content.body);
		expect(lessonSchema.safeParse({ ...content, body: 'x'.repeat(20_001) }).success).toBe(false);
	});
});
