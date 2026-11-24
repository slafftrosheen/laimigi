<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		getMessages,
		locales,
		localeNames,
		locationKeys,
		leagueLabel,
		type Locale
	} from '#lib/i18n/index';
	import type { Lesson } from '#lib/types';
	import Icon from './Icon.svelte';
	let {
		locale,
		lesson,
		action = ''
	}: { locale: Locale; lesson?: Lesson; action?: string } = $props();
	let m = $derived(getMessages(locale));
	let busy = $state(false);
</script>

<form
	method="POST"
	{action}
	use:enhance={() => {
		busy = true;
		return async ({ update }) => {
			await update({ reset: !lesson });
			busy = false;
		};
	}}
>
	<label class="field">
		<span>{m.title}</span><input
			name="title"
			minlength="3"
			maxlength="120"
			required
			value={lesson?.title ?? ''}
		/>
	</label><label class="field">
		<span>{m.description}</span><textarea
			name="description"
			maxlength="400"
			rows="2"
			value={lesson?.description ?? ''}></textarea>
	</label>
	<div class="field-row">
		<label class="field">
			<span>{m.contentLanguage}</span><select name="locale" value={lesson?.locale ?? locale}>
				{#each locales as language (language)}<option value={language}>
						{localeNames[language]}
					</option>{/each}
			</select>
		</label><label class="field">
			<span>{m.ageBand}</span><select name="age_band" value={lesson?.age_band ?? '7-9'}>
				{#each ['4-6', '7-9', '10-12'] as age (age)}<option value={age}>
						{leagueLabel(age, locale)}
					</option>{/each}
			</select>
		</label>
	</div>
	<label class="field">
		<span>{m.location}</span><select name="location" value={lesson?.location ?? 'school'}>
			{#each locationKeys as location (location)}<option value={location}>
					{m[location]}
				</option>{/each}
		</select>
	</label><label class="field">
		<span>{m.body}</span><textarea
			name="body"
			minlength="10"
			maxlength="20000"
			rows={lesson ? 15 : 8}
			required
			value={lesson?.body ?? ''}></textarea><small>{m.bodyHint}</small>
	</label>{#if lesson}<label class="field">
			<span>{m.status}</span><select name="status" value={lesson.status}>
				<option value="draft">{m.draft}</option><option value="published">{m.published}</option>
			</select>
		</label>{/if}<button class="btn" disabled={busy}>
		{busy ? m.saving : lesson ? m.save : m.createDraft}<Icon
			name={lesson ? 'check' : 'plus'}
			size={18}
		/>
	</button>
</form>
