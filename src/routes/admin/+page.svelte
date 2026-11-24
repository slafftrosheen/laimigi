<script lang="ts">
	import { resolve } from '$app/paths';
	import { getMessages } from '#lib/i18n/index';
	import Icon from '#lib/components/Icon.svelte';
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
	let m = $derived(getMessages(data.locale));
</script>

<svelte:head><title>{m.admin} · Laimīgie bērni</title></svelte:head>
<div class="container">
	<div class="page-heading">
		<div class="eyebrow"><Icon name="shield" size={16} />{m.rootOnly}</div>
		<h1>{m.adminTitle}</h1>
		<p>{m.adminIntro}</p>
	</div>
	<section class="content-section">
		<div class="grid-2">
			<a class="admin-link panel" href={resolve('/admin/ai')}>
				<div class="icon-disc"><Icon name="key" size={25} /></div>
				<h2>{m.manageProviders}</h2>
				<p>{m.manageProvidersBody}</p>
				<span class="text-link">{m.open}<Icon name="arrow" size={17} /></span>
			</a><a class="admin-link panel" href={resolve('/admin/users')}>
				<div class="icon-disc"><Icon name="family" size={25} /></div>
				<h2>{m.manageUsers}</h2>
				<p>{m.manageUsersBody}</p>
				<span class="text-link">{m.open}<Icon name="arrow" size={17} /></span>
			</a>
		</div>
		<div class="admin-bottom">
			<section class="panel">
				<h2>{m.serviceStatus}</h2>
				{#each [[m.database, data.setup.database], [m.encryption, data.setup.encryption], [m.serviceCredential, data.setup.service]] as [label, ready] (String(label))}<div
						class="status-row"
					>
						<span>{label}</span><span class="badge">
							<span class="status-dot" class:off={!ready}></span>{ready ? m.ready : m.notConfigured}
						</span>
					</div>{/each}
				<p class="small muted" style="margin-top:18px">{m.systemNote}</p>
			</section>
			<section class="panel counts">
				<div>
					<span class="eyebrow">{m.yourHeroes}</span><strong>{data.counts.heroes ?? '—'}</strong>
				</div>
				<div>
					<span class="eyebrow">{m.materials}</span><strong>{data.counts.lessons ?? '—'}</strong>
				</div>
				<a class="text-link" href={resolve('/studio')}>{m.studio}<Icon name="arrow" size={17} /></a>
			</section>
		</div>
	</section>
</div>

<style>
	.admin-link {
		padding: 30px;
		display: flex;
		align-items: flex-start;
		flex-direction: column;
		transition:
			border-color 0.15s,
			transform 0.15s;
	}
	.admin-link:hover {
		border-color: #adbe9d;
		transform: translateY(-2px);
	}
	.admin-link h2 {
		margin: 23px 0 11px;
	}
	.admin-link p {
		font-size: 0.85rem;
		color: var(--muted);
		max-width: 440px;
		margin-bottom: 25px;
	}
	.admin-link .text-link {
		margin-top: auto;
	}
	.admin-bottom {
		display: grid;
		grid-template-columns: 1.3fr 1fr;
		gap: 24px;
		margin-top: 24px;
	}
	.counts {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 20px;
		align-content: space-between;
		padding: 35px;
	}
	.counts strong {
		display: block;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 3.6rem;
		margin-top: 14px;
		line-height: 1.2;
	}
	.counts .eyebrow {
		font-size: 0.59rem;
	}
	.counts > .text-link {
		grid-column: 1/-1;
	}
	@media (max-width: 750px) {
		.admin-bottom {
			grid-template-columns: 1fr;
		}
		.counts strong {
			font-size: 3rem;
		}
		.counts {
			gap: 30px;
		}
		.admin-link h2 {
			font-size: 1.7rem;
		}
	}
</style>
