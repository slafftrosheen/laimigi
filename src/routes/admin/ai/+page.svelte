<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { getMessages } from '#lib/i18n/index';
	import Icon from '#lib/components/Icon.svelte';
	import Notice from '#lib/components/Notice.svelte';
	import type { PageProps } from './$types';
	let { data, form }: PageProps = $props();
	let m = $derived(getMessages(data.locale));
	let busy = $state('');
	let removal = $state('');
	let ready = $derived(data.encryptionReady && data.serviceReady && !data.error);
	const providerIds = ['openrouter', 'openai'] as const;
</script>

<svelte:head><title>{m.manageProviders} · Laimīgie bērni</title></svelte:head>
<div class="container">
	<div class="page-heading">
		<a class="text-link" href={resolve('/admin')}><Icon name="back" size={16} />{m.admin}</a>
		<h1>{m.securityTitle}</h1>
		<p>{m.securityIntro}</p>
	</div>
	<Notice {form} locale={data.locale} />{#if !ready}<div class="notice">
			<Icon name="info" size={20} /><span>{m.settingsUnavailable}</span>
		</div>{/if}
	<div class="grid-2 content-section">
		{#each providerIds as id (id)}{@const provider = data.providers.find(
				(item) => item.provider === id
			)}
			<section class="panel provider-panel" aria-label={id === 'openai' ? m.openai : m.openrouter}>
				<div class="provider-heading">
					<div class="icon-disc">
						<Icon name={id === 'openai' ? 'spark' : 'compass'} size={25} />
					</div>
					<div>
						<h2>{id === 'openai' ? m.openai : m.openrouter}</h2>
						<p>{id === 'openai' ? m.openaiHint : m.openrouterHint}</p>
					</div>
				</div>
				<div class="key-status">
					<span class="badge" class:gold={Boolean(provider?.key_hint)}>
						<Icon name="lock" size={13} />{provider?.key_hint ? m.keySaved : m.keyAbsent}
					</span>{#if provider?.key_hint}<span class="mono">•••• {provider.key_hint}</span>{/if}
				</div>
				<form
					method="POST"
					action="?/save"
					use:enhance={() => {
						busy = id;
						return async ({ update }) => {
							await update();
							busy = '';
						};
					}}
				>
					<input type="hidden" name="provider" value={id} />
					<fieldset disabled={!ready || busy !== ''} class="fieldset">
						<label class="field">
							<span>{m.apiKey}</span><input
								type="password"
								name="api_key"
								autocomplete="new-password"
								maxlength="512"
								spellcheck="false"
								placeholder={provider?.key_hint ? m.keyKeep : ''}
							/><small>{m.keyHint}</small>
						</label><label class="field">
							<span>{m.model}</span><input
								name="model"
								required
								minlength="1"
								maxlength="160"
								value={provider?.model ?? ''}
								autocomplete="off"
								spellcheck="false"
							/><small>{m.modelHint}</small>
						</label>
						<div class="field-row">
							<label class="field">
								<span>{m.maxTokens}</span><input
									type="number"
									name="max_output_tokens"
									required
									min="64"
									max="4096"
									step="1"
									value={provider?.max_output_tokens ?? 1024}
								/>
							</label><label class="field">
								<span>{m.dailyLimit}</span><input
									type="number"
									name="daily_request_limit"
									required
									min="1"
									max="10000"
									step="1"
									value={provider?.daily_request_limit ?? 30}
								/>
							</label>
						</div>
						<label class="check-field">
							<input
								type="checkbox"
								name="enabled"
								value="true"
								checked={provider?.enabled ?? false}
							/><span>{m.enabled}</span>
						</label><button class="btn block" disabled={!ready || busy !== ''}>
							{busy === id ? m.saving : m.save}<Icon name="check" size={17} />
						</button>
					</fieldset>
				</form>
				<hr class="divider" />
				<form
					method="POST"
					action="?/test"
					use:enhance={() => {
						busy = `test-${id}`;
						return async ({ update }) => {
							await update();
							busy = '';
						};
					}}
				>
					<input type="hidden" name="provider" value={id} /><button
						class="btn secondary block"
						disabled={!ready || !provider?.enabled || !provider?.key_hint || busy !== ''}
					>
						{busy === `test-${id}` ? m.loading : m.testConnection}<Icon name="arrow" size={16} />
					</button>
					<p class="field-note">{m.testNote}</p>
				</form>
				{#if provider?.key_hint}<details class="detail-actions">
						<summary>{m.removeKey}</summary>
						<p class="small muted">{m.keyRemoveWarning}</p>
						<form
							method="POST"
							action="?/remove"
							use:enhance={() => {
								busy = `remove-${id}`;
								return async ({ update }) => {
									await update();
									busy = '';
									removal = '';
								};
							}}
						>
							<input type="hidden" name="provider" value={id} /><label
								class="check-field"
								style="margin-top:12px"
							>
								<input
									type="checkbox"
									required
									checked={removal === id}
									onchange={(event) => (removal = event.currentTarget.checked ? id : '')}
								/><span>{m.confirmRemove}</span>
							</label><button
								class="btn danger small"
								disabled={!ready || removal !== id || busy !== ''}
							>
								{m.removeKey}
							</button>
						</form>
					</details>{/if}
			</section>{/each}
		<p class="source-note key-footnote"><Icon name="shield" size={17} />{m.noSecretEcho}</p>
	</div>
</div>

<style>
	.provider-panel {
		height: fit-content;
		padding: 30px;
	}
	.provider-heading {
		display: flex;
		gap: 16px;
		align-items: center;
		margin-bottom: 22px;
	}
	.provider-heading h2 {
		font-family: var(--font-body);
		font-weight: 650;
		font-size: 1.25rem;
		letter-spacing: -0.04em;
		margin-bottom: 5px;
	}
	.provider-heading p {
		font-size: 0.76rem;
		color: var(--muted);
	}
	.provider-heading .icon-disc {
		flex: none;
	}
	.key-status {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 24px;
	}
	.key-status .mono {
		color: var(--muted);
	}
	.field-note {
		font-size: 0.69rem;
		line-height: 1.7;
		color: var(--muted);
		margin-top: 12px;
	}
	.key-footnote {
		grid-column: 1/-1;
		display: flex;
		gap: 10px;
		align-items: center;
	}
	.key-footnote :global(svg) {
		flex: none;
	}
	.provider-panel .fieldset {
		margin-bottom: 0;
	}
	.provider-panel .field-row .field > span {
		font-size: 0.71rem;
		min-height: 34px;
	}
	.provider-panel .detail-actions p {
		font-size: 0.73rem;
	}
	.provider-panel .check-field {
		font-size: 0.77rem;
	}
	@media (max-width: 1000px) {
		.provider-panel {
			padding: 24px;
		}
		.provider-panel .field-row {
			grid-template-columns: 1fr;
			gap: 0;
		}
		.provider-panel .field-row .field > span {
			min-height: auto;
		}
	}
	@media (max-width: 740px) {
		.grid-2 {
			grid-template-columns: 1fr;
		}
		.provider-panel .field-row {
			grid-template-columns: 1fr 1fr;
			gap: 15px;
		}
	}
	@media (max-width: 450px) {
		.provider-panel .field-row {
			grid-template-columns: 1fr;
			gap: 0;
		}
	}
</style>
