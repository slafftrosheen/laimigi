<script lang="ts">
	import { messageFor, type Locale } from '#lib/i18n/index';
	import Icon from './Icon.svelte';
	let {
		form,
		locale = 'lv'
	}: { form?: { error?: unknown; message?: unknown; success?: unknown } | null; locale?: Locale } =
		$props();
</script>

{#if form?.error}<div class="notice error" role="alert">
		<Icon name="info" size={20} /><span>{messageFor(form.error, locale)}</span>
	</div>{:else if form?.message}<div class="notice success" role="status">
		<Icon name="check" size={20} /><span>{messageFor(form.message, locale)}</span>
	</div>{/if}
