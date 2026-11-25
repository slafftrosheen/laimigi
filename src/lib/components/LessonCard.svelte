<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		getMessages,
		locationLabel,
		leagueLabel,
		localeNames,
		type Locale
	} from '#lib/i18n/index';
	import type { Lesson } from '#lib/types';
	import Icon from './Icon.svelte';
	let {
		lesson,
		locale,
		heroId,
		completed = false,
		inProgress = false
	}: {
		lesson: Lesson;
		locale: Locale;
		heroId?: string;
		completed?: boolean;
		inProgress?: boolean;
	} = $props();
	let m = $derived(getMessages(locale));
</script>

<a
	class="lesson-card"
	href={heroId
		? resolve(`/learn/[lessonId]?hero=${encodeURIComponent(heroId)}`, { lessonId: lesson.id })
		: resolve('/learn/[lessonId]', { lessonId: lesson.id })}
>
	<div class="lesson-card-art"><Icon name={lesson.location} size={37} stroke={1.3} /></div>
	<div class="lesson-card-content">
		<div class="lesson-meta">
			<span class="badge">{localeNames[lesson.locale]}</span><span class="badge">
				{lesson.age_band}
			</span>{#if completed}<span class="badge gold">
					<Icon name="check" size={12} />{m.completed}
				</span>{:else if inProgress}<span class="badge">
					<Icon name="clock" size={12} />{m.inProgress}
				</span>{/if}
		</div>
		<h3>{lesson.title}</h3>
		<p>{lesson.description}</p>
		<span class="sr-only">
			{leagueLabel(lesson.age_band, locale)} · {locationLabel(lesson.location, locale)}
		</span><span class="text-link">{m.openMaterial}<Icon name="arrow" size={16} /></span>
	</div>
</a>
