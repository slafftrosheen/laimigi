<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { getMessages, localeNames, locationLabel, leagueLabel } from '#lib/i18n/index';
	import Icon from '#lib/components/Icon.svelte';
	import Notice from '#lib/components/Notice.svelte';
	import Emblem from '#lib/components/Emblem.svelte';
	import type { PageProps } from './$types';
	let { data, form }: PageProps = $props();
	let m = $derived(getMessages(data.locale));
	let chosen = $state('');
	let busy = $state(false);
	let selectedHero = $derived(
		data.heroes.find((hero) => hero.id === (chosen || page.url.searchParams.get('hero'))) ||
			data.heroes[0]
	);
	let completed = $derived(
		Boolean(
			selectedHero &&
			data.progress.some(
				(item) => item.child_profile_id === selectedHero.id && item.status === 'completed'
			)
		)
	);
</script>

<svelte:head><title>{data.lesson.title} · Laimīgie bērni</title></svelte:head>
<div class="container lesson-page">
	<a
		class="text-link"
		href={selectedHero ? resolve('/play/[heroId]', { heroId: selectedHero.id }) : resolve('/learn')}
	>
		<Icon name="back" size={17} />{selectedHero ? m.worldTitle : m.backLibrary}
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
	<Notice {form} locale={data.locale} />
	<div class="split-grid content-section">
		<article class="learning-scroll">
			<p class="lesson-description">{data.lesson.description}</p>
			<hr class="divider" />
			<div class="prose">{data.lesson.body || m.noContent}</div>
			<div class="scroll-end"><Icon name="leaf" size={25} /></div>
		</article>
		<aside>
			<div class="panel">
				<div class="eyebrow"><Icon name="compass" size={15} />{m.yourProgress}</div>
				<h2>{m.chooseHero}</h2>
				{#if data.heroes.length}<form
						method="POST"
						action="?/complete"
						use:enhance={() => {
							busy = true;
							return async ({ update }) => {
								await update({ reset: false });
								busy = false;
							};
						}}
					>
						<label class="field">
							<span class="sr-only">{m.chooseHero}</span><select
								name="hero_id"
								value={selectedHero?.id}
								onchange={(event) => (chosen = event.currentTarget.value)}
							>
								{#each data.heroes as hero (hero.id)}<option value={hero.id}>
										{hero.nickname}
									</option>{/each}
							</select>
						</label>{#if selectedHero}<div class="learner">
								<Emblem avatar={selectedHero.avatar} size={57} />
								<div>
									<strong>{selectedHero.nickname}</strong>
									<p>{leagueLabel(selectedHero.age_band, data.locale)}</p>
								</div>
							</div>{/if}{#if completed}<div class="notice success">
								<Icon name="check" size={20} />
								<div>
									<strong>{m.completed}</strong>
									<p class="small">{m.completedBody}</p>
								</div>
							</div>{:else}<p class="small muted" style="margin-bottom:19px">
								{m.completionHint}
							</p>{/if}<button class="btn block" disabled={completed || busy}>
							{completed ? m.completed : busy ? m.saving : m.markComplete}<Icon
								name="check"
								size={17}
							/>
						</button>
					</form>{:else}<p class="small muted">{m.createHeroFirst}</p>
					<a class="btn block spacer-top" href={resolve('/family')}>
						{m.newHero}<Icon name="plus" size={17} />
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
		padding: 35px 0;
	}
	.lesson-banner h1 {
		font-size: clamp(2.3rem, 4vw, 3.6rem);
		margin: 11px 0 19px;
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
	.learning-scroll {
		border: 1px solid #d1c7a2;
		background: #fffae9;
		padding: 40px 42px;
		border-radius: 5px 5px 22px 22px;
		box-shadow:
			inset 0 4px 0 #ede0b9,
			0 10px 30px #5f512409;
		min-height: 400px;
	}
	.lesson-description {
		font-family: var(--font-display);
		font-size: 1.4rem;
		line-height: 1.6;
		letter-spacing: -0.02em;
		color: #647152;
	}
	.learning-scroll .divider {
		background: #e2dabb;
		margin: 25px 0;
	}
	.scroll-end {
		display: flex;
		justify-content: center;
		color: #b1b083;
		border-top: 1px solid #e2dabb;
		margin-top: 40px;
		padding-top: 22px;
	}
	.panel h2 {
		margin: 13px 0 19px;
	}
	.learner {
		display: flex;
		gap: 16px;
		align-items: center;
		margin-bottom: 22px;
	}
	.learner strong {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 1.4rem;
	}
	.learner p {
		font-size: 0.68rem;
		color: var(--muted);
		margin-top: 4px;
	}
	.lesson-note {
		display: flex;
		gap: 12px;
		margin-top: 23px;
		color: #7d8c70;
		align-items: flex-start;
	}
	.lesson-note :global(svg) {
		flex: none;
	}
	.lesson-note p {
		font-size: 0.8rem;
	}
	.notice strong {
		font-size: 0.8rem;
	}
	.notice p {
		margin-top: 5px;
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
		.learning-scroll {
			padding: 27px 24px;
		}
		.lesson-meta .badge {
			font-size: 0.59rem;
		}
	}
</style>
