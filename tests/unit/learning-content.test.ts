import { describe, expect, it } from 'vitest';
import { authorBlocksSchema } from '#lib/learning/content';
import { lessonSchema } from '#lib/validation';
import { parseLessonForm, learningError } from '#lib/server/lesson-editor';

const id = '60000000-0000-4000-8000-000000000001';
const optionA = '60000000-0000-4000-8000-000000000002';
const optionB = '60000000-0000-4000-8000-000000000003';
const choice = {
	id,
	type: 'choice' as const,
	prompt: 'Which shape has three sides?',
	options: [
		{ id: optionA, label: 'Triangle' },
		{ id: optionB, label: 'Circle' }
	],
	correct_option_id: optionA
};
const content = {
	title: 'A discovery',
	description: '',
	body: '',
	locale: 'lv',
	age_band: '7-9',
	location: 'school',
	blocks: [choice]
};

describe('authored curriculum boundaries', () => {
	it('permits an activity-only lesson while requiring real content for legacy lessons', () => {
		expect(lessonSchema.safeParse(content).success).toBe(true);
		expect(lessonSchema.safeParse({ ...content, blocks: [] }).success).toBe(false);
		expect(
			lessonSchema.safeParse({ ...content, blocks: [], body: 'A meaningful overview.' }).success
		).toBe(true);
	});
	it('rejects duplicate block and option identities', () => {
		expect(authorBlocksSchema.safeParse([choice, choice]).success).toBe(false);
		expect(
			authorBlocksSchema.safeParse([{ ...choice, options: [choice.options[0], choice.options[0]] }])
				.success
		).toBe(false);
	});
	it('requires a correct answer that actually belongs to the question', () => {
		expect(authorBlocksSchema.safeParse([{ ...choice, correct_option_id: id }]).success).toBe(
			false
		);
		expect(authorBlocksSchema.safeParse([{ ...choice, correct_option_id: '' }]).success).toBe(
			false
		);
	});
	it('rejects a false answer key on a reading or reflection block', () => {
		expect(
			authorBlocksSchema.safeParse([
				{ id, type: 'reflection', prompt: 'Try this with an adult.', correct_option_id: optionA }
			]).success
		).toBe(false);
	});
	it('bounds the authored activity count, option count and text', () => {
		expect(authorBlocksSchema.safeParse(Array.from({ length: 13 }, () => choice)).success).toBe(
			false
		);
		expect(
			authorBlocksSchema.safeParse([{ ...choice, options: [choice.options[0]] }]).success
		).toBe(false);
		expect(authorBlocksSchema.safeParse([{ ...choice, prompt: 'x'.repeat(1201) }]).success).toBe(
			false
		);
	});
});

describe('teacher form recovery', () => {
	function form(blocks = [choice]) {
		const values = new FormData();
		for (const [key, value] of Object.entries({ ...content, blocks: JSON.stringify(blocks) }))
			values.set(key, value);
		return values;
	}
	it('retains unfinished author work without accepting it for publication', () => {
		const result = parseLessonForm(form([{ ...choice, prompt: '', correct_option_id: '' }]));
		expect(result.parsed.success).toBe(false);
		expect(result.values.blocks[0]).toMatchObject({ id, prompt: '', correct_option_id: '' });
	});
	it('does not silently convert malformed block JSON into a valid empty lesson', () => {
		const values = form();
		values.set('blocks', '{invalid');
		values.set('body', 'A meaningful overview.');
		const result = parseLessonForm(values);
		expect(result.parsed.success).toBe(false);
		expect(result.values.blocks).toEqual([]);
	});
	it('does not return injected fields in retained form values', () => {
		const values = form();
		values.set('author_id', 'another-user');
		values.set('api_key', 'private-value');
		const result = parseLessonForm(values);
		expect(result.parsed.success).toBe(true);
		expect(JSON.stringify(result.values)).not.toContain('private-value');
		expect(JSON.stringify(result.values)).not.toContain('another-user');
	});
	it('maps known stale-progress errors without leaking arbitrary database messages', () => {
		expect(learningError({ message: 'lesson_changed' })).toBe('lesson_changed');
		expect(learningError({ message: 'previous_steps_required' })).toBe('steps_required');
		expect(learningError({ message: 'private schema details and secrets' })).toBe('save_failed');
	});
});
