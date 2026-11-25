<script lang="ts">
	import { resolve } from '$app/paths';
	import { getMessages } from '#lib/i18n/index';
	import Icon from '#lib/components/Icon.svelte';
	import Notice from '#lib/components/Notice.svelte';
	import LessonForm from '#lib/components/LessonForm.svelte';
	import type { PageProps } from './$types';
	let { data, form }: PageProps = $props();
	let m = $derived(getMessages(data.locale));
</script>

<svelte:head><title>{m.editMaterial} · Laimīgie bērni</title></svelte:head>
<div class="container narrow">
	<div class="page-heading">
		<a class="text-link" href={resolve('/studio')}><Icon name="back" size={16} />{m.backStudio}</a>
		<h1>{m.editMaterial}</h1>
		<p>{m.draftNote}</p>
	</div>
	<section class="content-section">
		<Notice {form} locale={data.locale} />
		<div class="panel">
			<LessonForm
				locale={data.locale}
				lesson={data.lesson}
				authorBlocks={data.authorBlocks}
				values={form && 'values' in form ? form.values : undefined}
			/>
		</div>
	</section>
</div>
