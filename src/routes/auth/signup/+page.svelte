<script lang="ts">
	import AuthPanel from '#lib/components/AuthPanel.svelte';
	import type { PageProps } from './$types';
	let { data, form }: PageProps = $props();
</script>

<AuthPanel mode="signup" locale={data.locale} configured={data.configured} {form} />
