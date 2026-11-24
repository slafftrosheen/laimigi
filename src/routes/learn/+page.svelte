<script lang="ts">
	import { resolve } from '$app/paths';
	import { getMessages, locales, localeNames, locationKeys, leagueLabel } from '#lib/i18n/index';
	import LessonCard from '#lib/components/LessonCard.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
	let m = $derived(getMessages(data.locale));
	let selectedAge = $derived(data.filters.age_band === 'all' ? '' : data.filters.age_band);
	let selectedLocation = $derived(data.filters.location === 'all' ? '' : data.filters.location);
	let selectedLanguage = $derived(data.filters.language);
	let lessons = $derived(data.lessons);
</script>

<svelte:head><title>{m.learn} · Laimīgie bērni</title></svelte:head>
<div class="container">
	<div class="page-heading">
		<div class="eyebrow"><Icon name="library" size={16} />{m.learn}</div>
		<h1>{m.libraryTitle}</h1>
		<p>{m.libraryIntro}</p>
	</div>
	<section class="content-section">
		<form class="filters" method="GET">
			<label class="field">
				<span>{m.contentLanguage}</span><select name="language" value={selectedLanguage}>
					{#each locales as locale (locale)}<option value={locale}>
							{localeNames[locale]}
						</option>{/each}
				</select>
			</label><label class="field">
				<span>{m.ageBand}</span><select name="age_band" value={selectedAge}>
					<option value="">{m.allAges}</option>{#each ['4-6', '7-9', '10-12'] as age (age)}<option
							value={age}
						>
							{leagueLabel(age, data.locale)}
						</option>{/each}
				</select>
			</label><label class="field">
				<span>{m.location}</span><select name="location" value={selectedLocation}>
					<option value="">{m.allPlaces}</option>{#each locationKeys as location (location)}<option
							value={location}
						>
							{m[location]}
						</option>{/each}
				</select>
			</label><button class="btn" type="submit">{m.filter}</button><a
				class="text-link"
				href={resolve('/learn')}
			>
				{m.clearFilters}
			</a>
		</form>
		{#if lessons.length}<div class="results-caption">
				{m.showing}
				{lessons.length}
				{m.lessonCount}
			</div>
			<div class="lesson-grid">
				{#each lessons as lesson (lesson.id)}<LessonCard {lesson} locale={data.locale} />{/each}
			</div>{:else}<div class="empty-state">
				<div class="icon-disc"><Icon name="library" size={27} /></div>
				<h3>{m.noLessons}</h3>
				<p>{m.noResults}</p>
				<a class="btn secondary small" href={resolve('/learn')}>{m.clearFilters}</a>
			</div>{/if}
	</section>
</div>

<style>
	.results-caption {
		font-size: 0.73rem;
		color: var(--muted);
		margin: 0 0 20px;
	}
</style>
