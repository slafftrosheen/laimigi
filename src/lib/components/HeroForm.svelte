<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import { getMessages, locales, localeNames, type Locale } from '#lib/i18n/index';
	import type { ChildProfile } from '#lib/types';
	import Emblem from './Emblem.svelte';
	import Icon from './Icon.svelte';
	let {
		locale,
		hero,
		values
	}: { locale: Locale; hero?: ChildProfile; values?: Record<string, unknown> } = $props();
	let m = $derived(getMessages(locale));
	let busy = $state(false);
	let fields = $state(
		untrack(() => ({
			nickname: typeof values?.nickname === 'string' ? values.nickname : (hero?.nickname ?? ''),
			age_band: typeof values?.age_band === 'string' ? values.age_band : (hero?.age_band ?? '4-6'),
			avatar: typeof values?.avatar === 'string' ? values.avatar : (hero?.avatar ?? 'leaf'),
			locale: typeof values?.locale === 'string' ? values.locale : (hero?.locale ?? locale)
		}))
	);
</script>

<form
	method="POST"
	action={hero ? '?/updateHero' : '?/createHero'}
	use:enhance={() => {
		busy = true;
		return async ({ update, result }) => {
			try {
				await update({ reset: false });
				if (!hero && result.type === 'success')
					fields = { nickname: '', age_band: '4-6', avatar: 'leaf', locale };
			} finally {
				busy = false;
			}
		};
	}}
>
	{#if hero}<input type="hidden" name="hero_id" value={hero.id} />{/if}
	<fieldset class="hero-fields" disabled={busy}>
		<legend class="sr-only">{hero ? m.editHero : m.newHero}</legend>
		<label class="field">
			<span>{m.nickname}</span><input
				name="nickname"
				minlength="2"
				maxlength="32"
				required
				autocomplete="off"
				bind:value={fields.nickname}
			/><small>{m.nicknameHint}</small>
		</label>
		<label class="field">
			<span>{m.ageBand}</span><select name="age_band" required bind:value={fields.age_band}>
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
						class:chosen={fields.avatar === avatar}
					>
						<input type="radio" name="avatar" value={avatar} bind:group={fields.avatar} /><Emblem
							{avatar}
							size={44}
						/><span>
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
			<span>{m.heroLanguage}</span><select name="locale" bind:value={fields.locale}>
				{#each locales as language (language)}<option value={language}>
						{localeNames[language]}
					</option>{/each}
			</select>
		</label>
		{#if hero}<p class="hero-edit-hint">{m.heroEditNote}</p>{/if}
		<button class="btn block" disabled={busy}>
			{busy ? m.saving : hero ? m.saveHero : m.newHero}<Icon
				name={hero ? 'check' : 'plus'}
				size={17}
			/>
		</button>
	</fieldset>
</form>

<style>
	.hero-fields {
		border: 0;
		padding: 0;
		margin: 0;
		min-width: 0;
	}
	.avatar-options {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 8px;
	}
	.avatar-options label {
		position: relative;
		border: 1px solid var(--line);
		border-radius: 9px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 23px 3px 10px;
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
		width: 15px;
		height: 15px;
		right: 4px;
		top: 4px;
		margin: 0;
		accent-color: var(--forest);
	}
	.avatar-options span {
		font-size: 0.58rem;
		color: var(--muted);
		text-align: center;
		overflow-wrap: anywhere;
	}
	.hero-edit-hint {
		font-size: 0.7rem;
		color: var(--muted);
		margin-bottom: 20px;
	}
</style>
