<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { getMessages, leagueLabel } from '#lib/i18n/index';
	import Emblem from '#lib/components/Emblem.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import Notice from '#lib/components/Notice.svelte';
	import HeroForm from '#lib/components/HeroForm.svelte';
	import RewardTrail from '#lib/components/RewardTrail.svelte';
	import type { PageProps } from './$types';
	let { data, form }: PageProps = $props();
	let m = $derived(getMessages(data.locale));
	let confirmId = $state('');
	let values = $derived(form && 'values' in form ? form.values : undefined);
</script>

<svelte:head><title>{m.family} · Laimīgie bērni</title></svelte:head>
<div class="container">
	<div class="page-heading">
		<div class="eyebrow"><Icon name="family" size={16} />{m.family}</div>
		<h1>{m.familyTitle}</h1>
		<p>{m.familyIntro}</p>
	</div>
	<Notice {form} locale={data.locale} />
	<div class="family-layout content-section">
		<section>
			<div class="section-heading">
				<h2>{m.yourHeroes}</h2>
				<span class="badge">{data.heroes.length}</span>
			</div>
			{#if !data.heroes.length}<div class="empty-state">
					<div class="icon-disc"><Icon name="compass" size={28} /></div>
					<h3>{m.noHeroes}</h3>
					<p>{m.noHeroesBody}</p>
					<a class="text-link" href="#create-hero">{m.newHero}<Icon name="arrow" size={16} /></a>
				</div>
			{:else}<div class="hero-grid">
					{#each data.heroes as hero (hero.id)}
						{@const started = data.progress.filter(
							(item) => item.child_profile_id === hero.id && item.status === 'in_progress'
						).length}
						<article class="hero-card">
							<div class="hero-card-top">
								<span class="badge">{hero.age_band}</span><span>{hero.locale.toUpperCase()}</span>
							</div>
							<div class="hero-card-identity">
								<Emblem avatar={hero.avatar} size={76} />
								<div>
									<h3>{hero.nickname}</h3>
									<p>{leagueLabel(hero.age_band, data.locale)}</p>
								</div>
							</div>
							<div class="hero-card-progress">
								<RewardTrail
									{hero}
									rewards={data.rewards}
									locale={data.locale}
									compact
								/>{#if started}<p class="started-count">
										<Icon name="clock" size={14} />{m.startedLessons}: {started}
									</p>{/if}
							</div>
							<form method="POST" action={resolve('/play/[heroId]/enter', { heroId: hero.id })}>
								<button class="btn block">{m.enterWorld}<Icon name="arrow" size={17} /></button>
							</form>
							<details class="hero-edit" open={values?.hero_id === hero.id}>
								<summary><Icon name="settings" size={16} />{m.editHero}</summary><HeroForm
									{hero}
									locale={data.locale}
									values={values?.hero_id === hero.id ? values : undefined}
								/>
							</details>
							<details class="detail-actions">
								<summary>{m.removeHero}</summary>
								<p class="small muted">{m.removeHeroWarning}</p>
								<form method="POST" action="?/removeHero" use:enhance>
									<input type="hidden" name="hero_id" value={hero.id} /><label class="check-field">
										<input
											type="checkbox"
											required
											checked={confirmId === hero.id}
											onchange={(event) => (confirmId = event.currentTarget.checked ? hero.id : '')}
										/><span>{m.confirmRemove}</span>
									</label><button class="btn danger small" disabled={confirmId !== hero.id}>
										{m.remove}
									</button>
								</form>
							</details>
						</article>
					{/each}
				</div>{/if}
			<div class="source-note spacer-top">{m.familyHint}</div>
			<div class="coming-note">
				<Icon name="calendar" size={24} />
				<div>
					<h3>{m.upcoming}</h3>
					<p>{m.upcomingBody}</p>
				</div>
			</div>
		</section>
		<aside class="panel" id="create-hero">
			<div class="eyebrow"><Icon name="plus" size={15} />{m.newHero}</div>
			<h2>{m.newHero}</h2>
			<HeroForm locale={data.locale} values={!values?.hero_id ? values : undefined} />
		</aside>
	</div>
</div>

<style>
	.family-layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 340px;
		align-items: start;
		gap: 32px;
	}
	.hero-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 20px;
		align-items: start;
	}
	.hero-card {
		min-width: 0;
		background: var(--paper);
		border: 1px solid var(--line);
		border-radius: 16px;
		padding: 23px;
	}
	.hero-card-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.hero-card-top > span:last-child {
		font-size: 0.61rem;
		color: var(--muted);
		font-weight: 650;
	}
	.hero-card-identity {
		display: flex;
		gap: 20px;
		align-items: center;
		margin: 28px 0;
	}
	.hero-card-identity > div {
		min-width: 0;
	}
	.hero-card h3 {
		font-family: var(--font-display);
		font-size: 1.8rem;
		font-weight: 400;
		letter-spacing: -0.03em;
		overflow-wrap: anywhere;
	}
	.hero-card-identity p {
		font-size: 0.68rem;
		color: var(--muted);
		margin-top: 7px;
	}
	.hero-card-progress {
		padding: 19px 0;
		margin-bottom: 20px;
		border-block: 1px solid var(--line);
	}
	.started-count {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 13px;
		font-size: 0.64rem;
		color: var(--muted);
	}
	.hero-edit {
		margin-top: 18px;
		padding-bottom: 15px;
		border-bottom: 1px solid var(--line);
	}
	.hero-edit > summary {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
		font-size: 0.75rem;
		font-weight: 650;
		padding: 3px 0;
	}
	.hero-edit[open] > summary {
		margin-bottom: 22px;
	}
	.detail-actions p {
		margin: 13px 0;
		font-size: 0.72rem;
	}
	.detail-actions .check-field {
		font-size: 0.71rem;
	}
	.hero-card .detail-actions {
		margin-top: 16px;
	}
	.hero-card .detail-actions summary {
		font-size: 0.67rem;
	}
	#create-hero {
		scroll-margin-top: 25px;
	}
	#create-hero h2 {
		font-size: 1.9rem;
		margin: 14px 0 23px;
	}
	.coming-note {
		display: flex;
		gap: 17px;
		padding: 24px;
		background: #edf0e4;
		border: 1px solid #d8dfca;
		border-radius: 13px;
		margin-top: 29px;
		color: #6d8063;
	}
	.coming-note :global(svg) {
		flex: none;
		margin-top: 2px;
	}
	.coming-note h3 {
		font-size: 0.82rem;
		margin-bottom: 7px;
	}
	.coming-note p {
		font-size: 0.74rem;
	}
	@media (max-width: 1120px) {
		.hero-grid {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 800px) {
		.family-layout {
			grid-template-columns: 1fr;
		}
		.hero-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@media (max-width: 600px) {
		.hero-grid {
			grid-template-columns: 1fr;
		}
		.hero-card {
			padding: 23px;
		}
		.hero-card-identity {
			gap: 18px;
		}
	}
</style>
