<script lang="ts">
	import { resolve } from '$app/paths';
	import { getMessages, locationKeys, leagueLabel, type LocationKey } from '#lib/i18n/index';
	import WorldMap from '#lib/components/WorldMap.svelte';
	import Emblem from '#lib/components/Emblem.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import LessonCard from '#lib/components/LessonCard.svelte';
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
	let m = $derived(getMessages(data.locale));
	let selected = $state<LocationKey | ''>('');
	let lessons = $derived(
		data.lessons.filter((lesson) => !selected || lesson.location === selected)
	);
	let completedIds = $derived(
		new Set(
			data.progress.filter((item) => item.status === 'completed').map((item) => item.lesson_id)
		)
	);
</script>

<svelte:head><title>{data.hero.nickname} · {m.worldTitle}</title></svelte:head>
<div class="container world-page">
	<div class="world-back">
		<a class="text-link" href={resolve('/family')}>
			<Icon name="back" size={17} />{m.backFamily}
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
						<Icon name="compass" size={13} />{m.yourProgress}: {completedIds.size}
					</span>
				</div>
			</div>
			<p class="small">{m.worldIntro}</p>
		</div>
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
			</button><a class="btn gold small" href={resolve('/learn')}>
				{m.viewLibrary}<Icon name="arrow" size={16} />
			</a>
		</div>
	</section>
	<section class="world-materials">
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
	}
</style>
