<script lang="ts">
	import { resolve } from '$app/paths';
	import { getMessages, localeNames, locationLabel, leagueLabel } from '#lib/i18n/index';
	import Icon from '#lib/components/Icon.svelte';
	import Notice from '#lib/components/Notice.svelte';
	import Emblem from '#lib/components/Emblem.svelte';
	import LessonPlayer from '#lib/components/LessonPlayer.svelte';
	import RewardTrail from '#lib/components/RewardTrail.svelte';
	import type { PageProps } from './$types';
	let { data, form }: PageProps = $props();
	let m = $derived(getMessages(data.locale));
	let selectedHero = $derived(data.heroes.find((hero) => hero.id === data.activeHeroId));
	let progress = $derived(data.progress.find((item) => item.child_profile_id === selectedHero?.id));
	let rewardEarned = $derived(
		data.rewards.some(
			(item) => item.child_profile_id === selectedHero?.id && item.lesson_id === data.lesson.id
		)
	);
	let revised = $derived(
		Boolean(progress && progress.content_version !== data.lesson.content_version)
	);
	let notice = $derived(form && 'stepResult' in form ? null : form);
</script>

<svelte:head><title>{data.lesson.title} · Laimīgie bērni</title></svelte:head>
<div class="container lesson-page">
	<a
		class="text-link"
		href={data.childMode
			? resolve('/play/[heroId]', { heroId: data.childMode.heroId })
			: resolve('/learn')}
	>
		<Icon name="back" size={17} />{data.childMode ? m.worldTitle : m.backLibrary}
	</a>
	<header class="lesson-banner">
		<div class="lesson-seal"><Icon name={data.lesson.location} size={40} stroke={1.2} /></div>
		<div>
			<div class="eyebrow">{locationLabel(data.lesson.location, data.locale)}</div>
			<h1>{data.lesson.title}</h1>
			<div class="lesson-meta">
				<span class="badge">{localeNames[data.lesson.locale]}</span><span class="badge">
					{leagueLabel(data.lesson.age_band, data.locale)}
				</span>
			</div>
		</div>
	</header>
	{#if data.lesson.description}<p class="lesson-description">{data.lesson.description}</p>{/if}
	<Notice form={notice} locale={data.locale} />
	{#if form?.error === 'lesson_changed'}<a
			class="btn secondary spacer-top"
			href={selectedHero
				? resolve(`/learn/[lessonId]?hero=${selectedHero.id}`, { lessonId: data.lesson.id })
				: resolve('/learn/[lessonId]', { lessonId: data.lesson.id })}
			data-sveltekit-reload
		>
			{m.update}<Icon name="arrow" size={17} />
		</a>{/if}
	{#if revised}<div class="notice">
			<Icon name="info" size={20} /><span>{m.revisionNotice}</span>
		</div>{/if}
	<div class="lesson-layout content-section">
		<div class="lesson-main">
			{#key `${data.lesson.id}:${data.lesson.content_version}:${selectedHero?.id ?? 'preview'}`}<LessonPlayer
					lesson={data.lesson}
					locale={data.locale}
					heroId={selectedHero?.id}
					blockProgress={data.blockProgress}
					{progress}
					{form}
					preview={!selectedHero}
					{rewardEarned}
				/>{/key}
		</div>
		<aside>
			<div class="panel learner-panel">
				<div class="eyebrow"><Icon name="compass" size={15} />{m.yourProgress}</div>
				{#if selectedHero}<div class="learner">
						<Emblem avatar={selectedHero.avatar} size={60} />
						<div>
							<h2>{selectedHero.nickname}</h2>
							<p>{leagueLabel(selectedHero.age_band, data.locale)}</p>
						</div>
					</div>
					<RewardTrail hero={selectedHero} rewards={data.rewards} locale={data.locale} compact />
					{#if !data.childMode && data.heroes.length > 1}<form method="GET" class="hero-picker">
							<label class="field">
								<span>{m.chooseHero}</span><select name="hero" value={selectedHero.id}>
									{#each data.heroes as hero (hero.id)}<option value={hero.id}>
											{hero.nickname}
										</option>{/each}
								</select>
							</label><button class="btn secondary block small">{m.update}</button>
						</form>{/if}
				{:else}<h2>{m.chooseHero}</h2>
					<p class="small muted">{m.selectHeroToSave}</p>
					<a class="btn block spacer-top" href={resolve('/family')}>
						{m.family}<Icon name="arrow" size={17} />
					</a>{/if}
			</div>
			<div class="lesson-note">
				<Icon name="leaf" size={23} />
				<p>{m.lessonNote}</p>
			</div>
		</aside>
	</div>
</div>

<style>
	.lesson-page {
		padding-top: 27px;
	}
	.lesson-banner {
		display: flex;
		align-items: center;
		gap: 26px;
		padding: 35px 0 24px;
	}
	.lesson-banner > div:last-child {
		min-width: 0;
	}
	.lesson-banner h1 {
		font-size: clamp(2.3rem, 4vw, 3.6rem);
		margin: 11px 0 19px;
		overflow-wrap: anywhere;
	}
	.lesson-banner .eyebrow {
		font-size: 0.63rem;
	}
	.lesson-seal {
		display: grid;
		place-items: center;
		width: 86px;
		height: 96px;
		background: var(--forest);
		color: #dfcb91;
		border: 3px double #b9b386;
		border-radius: 40% 40% 15% 15%;
		flex: none;
	}
	.lesson-description {
		font-size: 0.91rem;
		line-height: 1.8;
		color: var(--muted);
		max-width: 800px;
		margin-bottom: 30px;
		overflow-wrap: anywhere;
	}
	.lesson-layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 310px;
		gap: 32px;
		align-items: start;
		margin-top: 24px;
	}
	.lesson-main {
		min-width: 0;
	}
	.learner-panel {
		padding: 27px;
	}
	.learner {
		display: flex;
		align-items: center;
		gap: 17px;
		margin: 25px 0;
	}
	.learner > div {
		min-width: 0;
	}
	.learner h2 {
		font-size: 1.6rem;
		overflow-wrap: anywhere;
	}
	.learner p {
		font-size: 0.66rem;
		color: var(--muted);
		margin-top: 7px;
	}
	.learner-panel > h2 {
		font-size: 1.8rem;
		margin: 16px 0;
	}
	.hero-picker {
		border-top: 1px solid var(--line);
		padding-top: 24px;
		margin-top: 24px;
	}
	.lesson-note {
		display: flex;
		gap: 12px;
		align-items: flex-start;
		margin-top: 23px;
		color: #7d8c70;
	}
	.lesson-note :global(svg) {
		flex: none;
	}
	.lesson-note p {
		font-size: 0.78rem;
	}
	@media (max-width: 920px) {
		.lesson-layout {
			grid-template-columns: 1fr;
		}
		.learner-panel {
			max-width: 600px;
		}
	}
	@media (max-width: 600px) {
		.lesson-banner {
			align-items: flex-start;
			gap: 16px;
		}
		.lesson-seal {
			width: 56px;
			height: 65px;
		}
		.lesson-seal :global(svg) {
			width: 28px;
		}
		.lesson-banner h1 {
			font-size: 2.2rem;
		}
		.lesson-meta .badge {
			font-size: 0.59rem;
		}
		.lesson-layout {
			gap: 24px;
		}
	}
</style>
