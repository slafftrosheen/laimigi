<script lang="ts">
	import { resolve } from '$app/paths';
	import { getMessages, locationKeys, leagueLabel, type LocationKey } from '#lib/i18n/index';
	import WorldMap from '#lib/components/WorldMap.svelte';
	import Emblem from '#lib/components/Emblem.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import LessonCard from '#lib/components/LessonCard.svelte';
	import RewardTrail from '#lib/components/RewardTrail.svelte';
	import { latestUnfinishedLesson, heroRewardSummary } from '#lib/learning/presentation';
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
	let m = $derived(getMessages(data.locale));
	let selected = $state<LocationKey | ''>('');
	let lessons = $derived(
		data.lessons.filter((lesson) => !selected || lesson.location === selected)
	);
	let completedIds = $derived(
		new Set(
			data.progress
				.filter(
					(item) =>
						item.status === 'completed' &&
						data.lessons.some(
							(lesson) =>
								lesson.id === item.lesson_id && lesson.content_version === item.content_version
						)
				)
				.map((item) => item.lesson_id)
		)
	);
	let resume = $derived(latestUnfinishedLesson(data.lessons, data.progress, data.hero.id));
	let summary = $derived(heroRewardSummary(data.rewards, data.hero.id));
</script>

<svelte:head><title>{data.hero.nickname} · {m.worldTitle}</title></svelte:head>
<div class="container world-page">
	<div class="world-back">
		<a class="text-link" href={resolve('/auth/adult?next=/family')}>
			<Icon name="lock" size={17} />{m.adultArea}
		</a><span>
			{m.yourLeague}: {leagueLabel(data.hero.age_band, data.locale)}
		</span>
	</div>
	<section class="game-shell">
		<div class="game-toolbar">
			<div class="hero-identity">
				<Emblem avatar={data.hero.avatar} size={65} />
				<div>
					<div class="eyebrow">{m.worldTitle}</div>
					<h1>{data.hero.nickname}</h1>
					<span class="badge">
						<Icon name="compass" size={13} />{m.level}
						{summary.level} · {summary.xp} XP
					</span>
				</div>
			</div>
			<p class="small">{m.worldIntro}</p>
		</div>
		{#if resume}<a
				class="continue-discovery"
				href={resolve(`/learn/[lessonId]?hero=${data.hero.id}`, { lessonId: resume.id })}
			>
				<span class="continue-icon"><Icon name={resume.location} size={26} /></span>
				<div>
					<div class="eyebrow">{m.continueLesson}</div>
					<h2>{resume.title}</h2>
					<p>{m.continueAtStep}</p>
				</div>
				<Icon name="arrow" size={23} />
			</a>{/if}
		<div class="game-layout">
			<WorldMap locale={data.locale} active={selected} onselect={(key) => (selected = key)} />
			<nav class="game-panel" aria-label={m.choosePlace}>
				<h3>{m.choosePlace}</h3>
				{#each locationKeys as location, i (location)}<button
						class="legend-button"
						class:active={selected === location}
						aria-pressed={selected === location}
						onclick={() => (selected = selected === location ? '' : location)}
					>
						<span class="legend-number">{i + 1}</span><span>
							<strong>{m[location]}</strong><small>{m[`${location}Description`]}</small>
						</span>
					</button>{/each}
			</nav>
		</div>
		<div class="game-bottom actions">
			<button
				class="btn secondary small"
				onclick={() => (selected = '')}
				aria-pressed={selected === ''}
			>
				{m.allPlaces}
			</button><a class="btn gold small" href="#materials">
				{m.availableLessons}<Icon name="arrow" size={16} />
			</a>
		</div>
		<div class="world-rewards">
			<RewardTrail hero={data.hero} rewards={data.rewards} locale={data.locale} dark />
		</div>
	</section>
	<section class="world-materials" id="materials">
		<div class="section-heading">
			<div>
				<div class="eyebrow">{selected ? m[selected] : m.allPlaces}</div>
				<h2>{m.availableLessons}</h2>
			</div>
			<span class="badge">{data.hero.locale.toUpperCase()} · {data.hero.age_band}</span>
		</div>
		{#if lessons.length}<div class="lesson-grid">
				{#each lessons as lesson (lesson.id)}<LessonCard
						{lesson}
						locale={data.locale}
						heroId={data.hero.id}
						completed={completedIds.has(lesson.id)}
						inProgress={data.progress.some(
							(item) =>
								item.lesson_id === lesson.id &&
								item.content_version === lesson.content_version &&
								item.status === 'in_progress'
						)}
					/>{/each}
			</div>{:else}<div class="empty-state">
				<div class="icon-disc"><Icon name={selected || 'compass'} size={27} /></div>
				<h3>{m.noLessons}</h3>
				<p>{m.noLessonsBody}</p>
				{#if selected}<button class="btn secondary small" onclick={() => (selected = '')}>
						{m.allPlaces}
					</button>{/if}
			</div>{/if}
	</section>
</div>

<style>
	.world-page {
		padding-top: 24px;
		padding-bottom: 60px;
	}
	.world-back {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 20px;
		margin-bottom: 24px;
	}
	.world-back > span {
		font-size: 0.73rem;
		color: var(--muted);
	}
	.world-materials {
		padding-top: 36px;
		scroll-margin-top: 20px;
	}
	.world-materials .eyebrow {
		margin-bottom: 9px;
	}
	.game-toolbar .eyebrow {
		font-size: 0.59rem;
		letter-spacing: 0.12em;
		margin-bottom: 5px;
	}
	.game-toolbar h1 {
		margin-bottom: 9px;
	}
	.game-toolbar > p {
		max-width: 260px;
		font-size: 0.77rem;
	}
	.world-materials .section-heading h2 {
		font-size: 2.2rem;
	}
	.continue-discovery {
		display: flex;
		align-items: center;
		gap: 17px;
		background: #2a5140;
		border: 1px solid #829568;
		border-radius: 15px;
		padding: 21px;
		margin-bottom: 24px;
	}
	.continue-discovery:hover {
		background: #315a44;
	}
	.continue-discovery > div {
		flex: 1;
		min-width: 0;
	}
	.continue-discovery h2 {
		font-size: 1.6rem;
		margin-top: 7px;
		overflow-wrap: anywhere;
	}
	.continue-discovery p {
		font-size: 0.7rem;
		margin-top: 6px;
	}
	.continue-icon {
		display: grid;
		place-items: center;
		flex: none;
		width: 48px;
		height: 55px;
		color: #e6d3a0;
		background: #3b6148;
		border: 1px solid #829568;
		border-radius: 14px;
	}
	.continue-discovery > :global(svg) {
		flex: none;
		color: #d9c690;
	}
	.world-rewards {
		margin-top: 29px;
		padding-top: 26px;
		border-top: 1px solid #49654a;
	}
	@media (max-width: 600px) {
		.world-back {
			flex-direction: column;
			align-items: flex-start;
			gap: 12px;
		}
		.world-back > span {
			font-size: 0.68rem;
		}
		.game-toolbar > p {
			max-width: none;
		}
		.world-materials .section-heading {
			flex-direction: row;
			align-items: center;
		}
		.world-materials .section-heading h2 {
			font-size: 1.8rem;
		}
		.continue-discovery {
			padding: 17px;
			gap: 13px;
		}
		.continue-discovery h2 {
			font-size: 1.3rem;
		}
		.continue-discovery > :global(svg) {
			display: none;
		}
	}
</style>
