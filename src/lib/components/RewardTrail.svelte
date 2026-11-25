<script lang="ts">
	import { formatMessage, getMessages, type Locale, type MessageKey } from '#lib/i18n/index';
	import { heroRewardSummary, type AchievementId } from '#lib/learning/presentation';
	import type { ChildProfile, HeroReward } from '#lib/types';
	import Icon from './Icon.svelte';
	let {
		hero,
		rewards,
		locale,
		compact = false,
		dark = false
	}: {
		hero: ChildProfile;
		rewards: HeroReward[];
		locale: Locale;
		compact?: boolean;
		dark?: boolean;
	} = $props();
	let m = $derived(getMessages(locale));
	let summary = $derived(heroRewardSummary(rewards, hero.id));
	let suffix = $derived(hero.age_band === '4-6' ? '46' : hero.age_band === '7-9' ? '79' : '1012');
	const icons: Record<AchievementId, string> = {
		first: 'compass',
		steady: 'crystal',
		world: 'globe'
	};
	const requirements: Record<AchievementId, MessageKey> = {
		first: 'firstRequirement',
		steady: 'steadyRequirement',
		world: 'worldRequirement'
	};
</script>

<section class="reward-trail" class:dark class:compact aria-label={m.progressCollection}>
	<div class="reward-summary">
		<div><span>{m.level}</span><strong>{summary.level}</strong></div>
		<div><span>{m.experience}</span><strong>{summary.xp}<small> XP</small></strong></div>
		<div><span>{m.completedLessons}</span><strong>{summary.discoveries}</strong></div>
	</div>
	<div class="level-line">
		<progress max="100" value={summary.levelXP} aria-label={m.levelProgress}></progress>
		<span>{formatMessage(m.nextLevel, { xp: summary.nextLevelXP })}</span>
	</div>
	{#if !compact}
		<div class="collection-heading">
			<h2>{m.achievements}</h2>
			<p>{m.rewardRule}</p>
		</div>
		<div class="achievement-grid" data-league={hero.age_band}>
			{#each summary.achievements as achievement (achievement.id)}
				<article class="achievement" class:earned={achievement.earned}>
					<div class="achievement-crest" aria-hidden="true">
						<span><Icon name={icons[achievement.id]} size={27} stroke={1.4} /></span>
					</div>
					<div class="achievement-copy">
						<span class="achievement-state">
							{achievement.earned ? m.achievementEarned : m.achievementLocked}
						</span>
						<h3>{m[`${achievement.id}${suffix}` as MessageKey]}</h3>
						<p>{m[requirements[achievement.id]]}</p>
						<span class="achievement-count">
							<Icon name={achievement.earned ? 'check' : 'lock'} size={13} />{formatMessage(
								m.achievementProgress,
								{ current: achievement.current, target: achievement.target }
							)}
						</span>
					</div>
				</article>
			{/each}
		</div>
	{/if}
</section>

<style>
	.reward-trail {
		--reward-ink: var(--ink);
		--reward-muted: var(--muted);
		--reward-border: var(--line);
		color: var(--reward-ink);
	}
	.reward-summary {
		display: grid;
		grid-template-columns: 0.7fr 1fr 1.2fr;
		gap: 16px;
	}
	.reward-summary > div {
		min-width: 0;
	}
	.reward-summary span {
		display: block;
		font-size: 0.65rem;
		line-height: 1.5;
		color: var(--reward-muted);
	}
	.reward-summary strong {
		display: block;
		font-family: var(--font-display);
		font-size: 2rem;
		font-weight: 400;
		margin-top: 4px;
	}
	.reward-summary small {
		font-family: var(--font-body);
		font-size: 0.64rem;
		font-weight: 650;
	}
	.level-line {
		display: flex;
		align-items: center;
		gap: 15px;
		margin-top: 17px;
	}
	.level-line progress {
		appearance: none;
		width: 100%;
		min-width: 0;
		height: 6px;
		overflow: hidden;
		border: 0;
		border-radius: 4px;
		background: #dce2d3;
	}
	.level-line progress::-webkit-progress-bar {
		background: #dce2d3;
		border-radius: 4px;
	}
	.level-line progress::-webkit-progress-value {
		background: #b28c45;
		border-radius: 4px;
	}
	.level-line progress::-moz-progress-bar {
		background: #b28c45;
		border-radius: 4px;
	}
	.level-line > span {
		flex: none;
		font-size: 0.64rem;
		color: var(--reward-muted);
	}
	.collection-heading {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 20px;
		margin-top: 32px;
		margin-bottom: 17px;
	}
	.collection-heading h2 {
		font-size: 1.8rem;
	}
	.collection-heading p {
		font-size: 0.67rem;
		color: var(--reward-muted);
		max-width: 310px;
	}
	.achievement-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 14px;
	}
	.achievement {
		display: flex;
		align-items: flex-start;
		gap: 14px;
		padding: 21px 18px;
		border: 1px solid var(--reward-border);
		border-radius: 14px;
		background: #ffffff35;
	}
	.achievement-copy {
		min-width: 0;
	}
	.achievement-crest {
		width: 55px;
		height: 64px;
		flex: none;
		display: grid;
		place-items: center;
		background: #d9ddcf;
		color: #7d8776;
		clip-path: polygon(50% 0, 94% 17%, 94% 67%, 50% 100%, 6% 67%, 6% 17%);
	}
	.achievement-crest > span {
		display: grid;
		place-items: center;
		width: 39px;
		height: 45px;
		border: 1px solid currentColor;
		border-radius: 35% 35% 42% 42%;
	}
	.earned .achievement-crest {
		background: linear-gradient(145deg, #d6ba76, #806333);
		color: #fff5d6;
	}
	.achievement-grid[data-league='4-6'] .achievement-crest {
		clip-path: none;
		border-radius: 24px;
		height: 55px;
		background: #dfe4d2;
	}
	.achievement-grid[data-league='4-6'] .earned .achievement-crest {
		background: linear-gradient(145deg, #86a76c, #345a43);
	}
	.achievement-grid[data-league='10-12'] .achievement-crest {
		clip-path: polygon(0 0, 100% 0, 100% 78%, 50% 100%, 0 78%);
	}
	.achievement-grid[data-league='10-12'] .earned .achievement-crest {
		background: linear-gradient(145deg, #6f81a4, #293e60);
	}
	.achievement-state {
		display: block;
		font-size: 0.54rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--reward-muted);
		margin-bottom: 7px;
	}
	.achievement h3 {
		font-size: 0.86rem;
		overflow-wrap: anywhere;
	}
	.achievement p {
		font-size: 0.68rem;
		color: var(--reward-muted);
		margin-top: 6px;
	}
	.achievement-count {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		margin-top: 10px;
		font-size: 0.64rem;
		font-weight: 650;
	}
	.dark {
		--reward-ink: #f6e8c7;
		--reward-muted: #c3cfb9;
		--reward-border: #506d4e;
	}
	.dark .achievement {
		background: #214a3d;
	}
	.dark .level-line progress,
	.dark .level-line progress::-webkit-progress-bar {
		background: #3d5f4f;
	}
	.compact .reward-summary strong {
		font-size: 1.6rem;
	}
	.compact .level-line {
		flex-direction: column;
		align-items: stretch;
		gap: 8px;
	}
	@media (max-width: 1000px) {
		.achievement {
			flex-direction: column;
			padding: 18px;
		}
	}
	@media (max-width: 600px) {
		.level-line {
			flex-direction: column;
			align-items: stretch;
			gap: 9px;
		}
		.collection-heading {
			display: block;
		}
		.collection-heading p {
			margin-top: 9px;
		}
		.achievement-grid {
			grid-template-columns: 1fr;
		}
		.achievement {
			flex-direction: row;
		}
		.reward-summary {
			gap: 12px;
		}
		.reward-summary strong {
			font-size: 1.7rem;
		}
		.reward-summary span {
			font-size: 0.6rem;
		}
	}
</style>
