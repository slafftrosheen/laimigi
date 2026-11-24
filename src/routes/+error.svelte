<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { getMessages, messageFor } from '#lib/i18n/index';
	import Icon from '#lib/components/Icon.svelte';
	let m = $derived(getMessages(page.data.locale));
</script>

<svelte:head><title>{page.status} · Laimīgie bērni</title></svelte:head>
<section class="error-page">
	<div class="icon-disc"><Icon name="compass" size={28} /></div>
	<div class="eyebrow" style="justify-content:center;margin-top:22px">{page.status}</div>
	<h1>{m.errorTitle}</h1>
	<p>{page.status === 404 ? m.notFound : messageFor(page.error?.message, page.data.locale)}</p>
	<a class="btn" href={resolve('/')}>{m.backHome}<Icon name="arrow" size={18} /></a>
</section>
