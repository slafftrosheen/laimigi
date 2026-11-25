import type { BlockProgress, HeroReward, Lesson, LessonProgress } from '#lib/types';

export const XP_PER_LEVEL = 100;
export const XP_PER_LESSON = 25;
export type AchievementId = 'first' | 'steady' | 'world';

/** Derive presentation exclusively from persisted awards, never from optimistic UI state. */
export function heroRewardSummary(rewards: readonly HeroReward[], heroId: string) {
	const distinct = new Map<string, HeroReward>();
	for (const reward of rewards) {
		if (reward.child_profile_id === heroId && !distinct.has(reward.lesson_id))
			distinct.set(reward.lesson_id, reward);
	}
	const earned = [...distinct.values()];
	const xp = earned.reduce((sum, reward) => sum + Math.max(0, Math.trunc(reward.xp)), 0);
	const discoveries = earned.length;
	const places = new Set(earned.map((reward) => reward.location)).size;
	const levelXP = xp % XP_PER_LEVEL;
	return {
		xp,
		discoveries,
		places,
		level: Math.floor(xp / XP_PER_LEVEL) + 1,
		levelXP,
		nextLevelXP: XP_PER_LEVEL - levelXP,
		achievements: [
			{ id: 'first', current: Math.min(discoveries, 1), target: 1, earned: discoveries >= 1 },
			{ id: 'steady', current: Math.min(discoveries, 5), target: 5, earned: discoveries >= 5 },
			{ id: 'world', current: Math.min(places, 3), target: 3, earned: places >= 3 }
		] as { id: AchievementId; current: number; target: number; earned: boolean }[]
	};
}

export function savedBlockIds(
	progress: readonly BlockProgress[],
	lesson: Pick<Lesson, 'id' | 'content_version' | 'blocks'>,
	heroId: string | null
) {
	const valid = new Set(lesson.blocks.map((block) => block.id));
	return new Set(
		progress
			.filter(
				(row) =>
					row.child_profile_id === heroId &&
					row.lesson_id === lesson.id &&
					row.content_version === lesson.content_version &&
					valid.has(row.block_id)
			)
			.map((row) => row.block_id)
	);
}

export function latestUnfinishedLesson(
	lessons: readonly Lesson[],
	progress: readonly LessonProgress[],
	heroId: string
): Lesson | null {
	const candidates = progress
		.filter((row) => row.child_profile_id === heroId && row.status === 'in_progress')
		.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
	for (const row of candidates) {
		const lesson = lessons.find(
			(item) => item.id === row.lesson_id && item.content_version === row.content_version
		);
		if (lesson) return lesson;
	}
	return null;
}
