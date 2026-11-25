import { z } from 'zod';

const option = z.strictObject({ id: z.uuid(), label: z.string().trim().min(1).max(400) });
const reading = z.strictObject({
	id: z.uuid(),
	type: z.literal('reading'),
	title: z.string().trim().min(1).max(160),
	body: z.string().trim().min(1).max(6_000)
});
const reflection = z.strictObject({
	id: z.uuid(),
	type: z.literal('reflection'),
	prompt: z.string().trim().min(1).max(1_200)
});
const choice = z.strictObject({
	id: z.uuid(),
	type: z.literal('choice'),
	prompt: z.string().trim().min(1).max(1_200),
	options: z.array(option).min(2).max(4),
	correct_option_id: z.uuid()
});

export const authorBlocksSchema = z
	.array(z.discriminatedUnion('type', [reading, choice, reflection]))
	.max(12)
	.superRefine((blocks, context) => {
		if (new Set(blocks.map((block) => block.id)).size !== blocks.length)
			context.addIssue({ code: 'custom', message: 'Duplicate block ID' });
		for (const [index, block] of blocks.entries()) {
			if (block.type !== 'choice') continue;
			if (new Set(block.options.map((item) => item.id)).size !== block.options.length)
				context.addIssue({
					code: 'custom',
					path: [index, 'options'],
					message: 'Duplicate option ID'
				});
			if (!block.options.some((item) => item.id === block.correct_option_id))
				context.addIssue({
					code: 'custom',
					path: [index, 'correct_option_id'],
					message: 'Missing correct option'
				});
		}
	});

// Preserve unfinished author inputs after validation errors, without echoing
// arbitrary structures, unknown fields or oversized values into the page.
export const editorBlocksSchema = z
	.array(
		z.discriminatedUnion('type', [
			reading.extend({ title: z.string().max(160), body: z.string().max(6_000) }),
			choice.extend({
				prompt: z.string().max(1_200),
				options: z.array(option.extend({ label: z.string().max(400) })).max(4),
				correct_option_id: z.string().max(36)
			}),
			reflection.extend({ prompt: z.string().max(1_200) })
		])
	)
	.max(12);
