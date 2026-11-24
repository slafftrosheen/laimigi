<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { getMessages, leagueLabel, locales, localeNames } from '#lib/i18n/index';
	import Emblem from '#lib/components/Emblem.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import Notice from '#lib/components/Notice.svelte';
	import type { PageProps } from './$types';
	let { data, form }: PageProps = $props();
	let m = $derived(getMessages(data.locale));
	let selectedAvatar = $state('leaf');
	let busy = $state(false);
	let confirmId = $state('');
</script>

<svelte:head><title>{m.family} · Laimīgie bērni</title></svelte:head>
<div class="container">
	<div class="page-heading">
		<div class="eyebrow"><Icon name="family" size={16} />{m.family}</div>
		<h1>{m.familyTitle}</h1>
		<p>{m.familyIntro}</p>
	</div>
	<Notice {form} locale={data.locale} />
	<div class="split-grid content-section">
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
				</div>{:else}<div class="hero-grid">
					{#each data.heroes as hero (hero.id)}<article class="hero-card">
							<div class="hero-card-top">
								<span class="badge">{hero.age_band}</span><span class="hero-locale">
									{hero.locale.toUpperCase()}
								</span>
							</div>
							<div class="hero-emblem"><Emblem avatar={hero.avatar} size={100} /></div>
							<h3>{hero.nickname}</h3>
							<p>{leagueLabel(hero.age_band, data.locale)}</p>
							<a class="btn block" href={resolve('/play/[heroId]', { heroId: hero.id })}>
								{m.enterWorld}<Icon name="arrow" size={17} />
							</a>
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
						</article>{/each}
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
			<h2 style="margin-top:14px">{m.newHero}</h2>
			<form
				method="POST"
				action="?/createHero"
				use:enhance={() => {
					busy = true;
					return async ({ update }) => {
						await update();
						busy = false;
					};
				}}
			>
				<label class="field">
					<span>{m.nickname}</span><input
						name="nickname"
						required
						minlength="2"
						maxlength="32"
						autocomplete="off"
					/><small>{m.nicknameHint}</small>
				</label><label class="field">
					<span>{m.ageBand}</span><select name="age_band" required>
						<option value="4-6">{m.age46}</option><option value="7-9">{m.age79}</option><option
							value="10-12"
						>
							{m.age1012}
						</option>
					</select>
				</label>
				<fieldset class="fieldset">
					<legend>{m.avatar}</legend>
					<div class="avatar-options">
						{#each ['leaf', 'compass', 'crystal'] as avatar (avatar)}<label
								class:chosen={selectedAvatar === avatar}
							>
								<input
									type="radio"
									name="avatar"
									value={avatar}
									bind:group={selectedAvatar}
								/><Emblem {avatar} size={49} /><span>
									{avatar === 'leaf'
										? m.avatarLeaf
										: avatar === 'compass'
											? m.avatarCompass
											: m.avatarCrystal}
								</span>
							</label>{/each}
					</div>
				</fieldset>
				<label class="field">
					<span>{m.heroLanguage}</span><select name="locale" value={data.locale}>
						{#each locales as locale (locale)}<option value={locale}>
								{localeNames[locale]}
							</option>{/each}
					</select>
				</label><button class="btn block" disabled={busy}>
					{busy ? m.saving : m.newHero}<Icon name="plus" size={17} />
				</button>
			</form>
		</aside>
	</div>
</div>

<style>
	.hero-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 20px;
	}
	.hero-card {
		background: var(--paper);
		border: 1px solid var(--line);
		border-radius: 16px;
		padding: 22px;
		text-align: center;
	}
	.hero-card-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.hero-locale {
		font-size: 0.63rem;
		font-weight: 650;
		color: var(--muted);
	}
	.hero-emblem {
		display: flex;
		justify-content: center;
		margin: 24px 0 24px;
	}
	.hero-card h3 {
		font-family: var(--font-display);
		font-size: 1.7rem;
		font-weight: 400;
		letter-spacing: -0.03em;
		overflow-wrap: anywhere;
	}
	.hero-card > p {
		font-size: 0.72rem;
		color: var(--muted);
		margin: 8px 0 21px;
	}
	.hero-card .detail-actions {
		text-align: left;
	}
	.hero-card .detail-actions p {
		font-size: 0.74rem;
		margin-bottom: 12px;
	}
	.hero-card .detail-actions .check-field {
		font-size: 0.72rem;
	}
	.hero-card .detail-actions summary {
		text-align: center;
		font-size: 0.69rem;
	}
	.avatar-options {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 10px;
	}
	.avatar-options label {
		position: relative;
		border: 1px solid var(--line);
		border-radius: 9px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 15px 3px 10px;
		background: #f7f7ed;
		cursor: pointer;
	}
	.avatar-options label.chosen {
		background: #e6ecd9;
		border-color: #668765;
		box-shadow: 0 0 0 1px #668765;
	}
	.avatar-options input {
		position: absolute;
		width: 16px;
		height: 16px;
		right: 4px;
		top: 4px;
		accent-color: var(--forest);
	}
	.avatar-options span {
		font-size: 0.63rem;
	}
	.coming-note {
		margin-top: 30px;
		padding: 22px;
		display: flex;
		align-items: flex-start;
		gap: 15px;
		background: #edeee3;
		border-radius: 12px;
		color: #819075;
	}
	.coming-note :global(svg) {
		flex: none;
		margin-top: 2px;
	}
	.coming-note h3 {
		font-size: 0.86rem;
		color: var(--ink);
		margin-bottom: 7px;
	}
	.coming-note p {
		font-size: 0.77rem;
		color: var(--muted);
	}
	aside.panel {
		height: fit-content;
		scroll-margin-top: 25px;
	}
	aside.panel h2 {
		font-size: 1.8rem;
		margin-bottom: 25px;
	}
	@media (max-width: 920px) {
		aside.panel {
			max-width: 550px;
			width: 100%;
		}
		.hero-grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
	@media (max-width: 700px) {
		.hero-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.hero-card {
			padding: 17px;
		}
	}
	@media (max-width: 450px) {
		.hero-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
