import { editorBlocksSchema } from '#lib/learning/content';
import { authorBlocksSchema } from '#lib/learning/content';
import { lessonSchema } from '#lib/validation';
import type { AuthorLessonBlock, Lesson } from '#lib/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { error } from '@sveltejs/kit';
import { z } from 'zod';

export interface LessonEditorValues {
	title: string;
	description: string;
	body: string;
	locale: string;
	age_band: string;
	location: string;
	status: string;
	blocks: AuthorLessonBlock[];
	updated_at: string;
}

export function parseLessonForm(form: FormData) {
	const field = (key: string, limit: number) => String(form.get(key) ?? '').slice(0, limit);
	let blocks: unknown;
	try {
		blocks = JSON.parse(String(form.get('blocks') ?? '[]'));
	} catch {
		blocks = null;
	}
	const parsed = lessonSchema.safeParse({
		title: form.get('title'),
		description: form.get('description') ?? '',
		body: form.get('body') ?? '',
		locale: form.get('locale'),
		age_band: form.get('age_band'),
		location: form.get('location'),
		status: form.get('status') ?? 'draft',
		blocks
	});
	const retained = editorBlocksSchema.safeParse(blocks);
	const values: LessonEditorValues = {
		title: field('title', 120),
		description: field('description', 400),
		body: field('body', 20_000),
		locale: field('locale', 2),
		age_band: field('age_band', 5),
		location: field('location', 32),
		status: field('status', 12) || 'draft',
		blocks: retained.success ? retained.data : [],
		updated_at: field('updated_at', 50)
	};
	return { parsed, values };
}

export const editTimestampSchema = z.iso.datetime({ offset: true });

export async function getEditorSnapshot(supabase: SupabaseClient, lessonId: string) {
	const { data, error: queryError } = await supabase.rpc('get_lesson_editor_snapshot', {
		p_lesson_id: lessonId
	});
	if (queryError?.code === '42501') error(404, 'not_found');
	if (queryError || !data || data.lesson?.id !== lessonId) error(503, 'database_unavailable');
	const authored = authorBlocksSchema.safeParse(data.author_blocks);
	if (!authored.success) error(503, 'database_unavailable');
	return { lesson: data.lesson as Lesson, authorBlocks: authored.data };
}

/** Only documented application codes are exposed; database details stay server-side. */
export function learningError(issue: { message?: string; code?: string } | null): string {
	if (issue?.message === 'lesson_changed') return 'lesson_changed';
	if (issue?.message === 'lesson_conflict') return 'lesson_conflict';
	if (issue?.message === 'previous_steps_required' || issue?.message === 'steps_required')
		return 'steps_required';
	return 'save_failed';
}
