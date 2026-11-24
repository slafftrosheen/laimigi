<script lang="ts">
	import { resolve } from '$app/paths';
	import { getMessages, locales, localeNames, leagueLabel, messageFor } from '#lib/i18n/index';
	import Icon from '#lib/components/Icon.svelte';
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
	let m = $derived(getMessages(data.locale));
	let busy = $state(false);
	let result = $state('');
	let resultModel = $state('');
	let error = $state('');
	let truncated = $state(false);
	let copied = $state(false);
	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (busy) return;
		const form = new FormData(event.currentTarget as HTMLFormElement);
		busy = true;
		error = '';
		copied = false;
		try {
			const response = await fetch('/api/ai/draft', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					provider: form.get('provider'),
					prompt: form.get('prompt'),
					locale: form.get('locale'),
					age_band: form.get('age_band')
				})
			});
			const body = await response.json();
			if (!response.ok) {
				error = body.error ?? 'provider_error';
				return;
			}
			result = typeof body.text === 'string' ? body.text : '';
			resultModel = typeof body.model === 'string' ? body.model : '';
			truncated = body.truncated === true;
		} catch {
			error = 'provider_error';
		} finally {
			busy = false;
		}
	}
	async function copy() {
		try {
			await navigator.clipboard.writeText(result);
			copied = true;
		} catch {
			copied = false;
		}
	}
</script>

<svelte:head><title>{m.assistant} · Laimīgie bērni</title></svelte:head>
<div class="container">
	<div class="page-heading">
		<a class="text-link" href={resolve('/studio')}><Icon name="back" size={16} />{m.backStudio}</a>
		<h1>{m.assistantTitle}</h1>
		<p>{m.assistantIntro}</p>
	</div>
	<div class="assistant-grid content-section">
		<section class="panel">
			<div class="eyebrow"><Icon name="spark" size={16} />{m.assistant}</div>
			<h2 style="margin:15px 0 22px">{m.assistantLabel}</h2>
			{#if !data.providers.length}<div class="notice">
					<Icon name="info" size={19} />{m.noAi}
				</div>{/if}{#if error}<div class="notice error" role="alert">
					{messageFor(error, data.locale)}
				</div>{/if}
			<form onsubmit={submit}>
				<div class="field-row">
					<label class="field">
						<span>{m.provider}</span><select
							name="provider"
							disabled={busy || !data.providers.length}
							required
						>
							{#each data.providers as provider (provider.provider)}<option
									value={provider.provider}
								>
									{provider.provider === 'openai' ? m.openai : m.openrouter} · {provider.model}
								</option>{/each}
						</select>
					</label><label class="field">
						<span>{m.contentLanguage}</span><select
							name="locale"
							value={data.locale}
							disabled={busy}
						>
							{#each locales as locale (locale)}<option value={locale}>
									{localeNames[locale]}
								</option>{/each}
						</select>
					</label>
				</div>
				<label class="field">
					<span>{m.ageBand}</span><select name="age_band" disabled={busy} value="7-9">
						{#each ['4-6', '7-9', '10-12'] as band (band)}<option value={band}>
								{leagueLabel(band, data.locale)}
							</option>{/each}
					</select>
				</label><label class="field">
					<span>{m.assistantLabel}</span><textarea
						name="prompt"
						required
						minlength="10"
						maxlength="6000"
						rows="8"
						placeholder={m.assistantPlaceholder}
						disabled={busy}></textarea><small>{m.aiPrivacy}</small>
				</label><button class="btn" disabled={busy || !data.providers.length}>
					{busy ? m.generating : m.generate}<Icon name="spark" size={18} />
				</button>
			</form>
		</section>
		<section class="assistant-result" aria-live="polite" aria-busy={busy}>
			{#if result}<div class="result-heading">
					<div class="eyebrow">{m.aiDraft}</div>
					<button class="btn secondary small" onclick={copy}>
						<Icon name={copied ? 'check' : 'copy'} size={16} />{copied ? m.copied : m.copy}
					</button>
				</div>
				<p class="source-note">{m.aiReview}</p>
				{#if truncated}<div class="notice spacer-top">{m.truncated}</div>{/if}
				<div class="prose result-text">{result}</div>
				<div class="model-note">{m.model}: {resultModel}</div>{:else}<div class="result-empty">
					<div class="icon-disc"><Icon name="workshop" size={30} /></div>
					<h2>{m.noDrafts}</h2>
					<p>{m.aiReview}</p>
				</div>{/if}
		</section>
	</div>
</div>

<style>
	.assistant-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 30px;
	}
	.assistant-grid > .panel {
		height: fit-content;
	}
	.assistant-result {
		background: #f3efdf;
		border: 1px solid #ded8bf;
		border-radius: 14px;
		padding: 28px;
		min-height: 430px;
		overflow: hidden;
	}
	.result-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 24px;
	}
	.result-text {
		font-size: 0.87rem;
		margin-top: 24px;
	}
	.result-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		min-height: 360px;
		gap: 20px;
	}
	.result-empty h2 {
		font-size: 2rem;
		max-width: 330px;
	}
	.result-empty p {
		font-size: 0.8rem;
		color: var(--muted);
		max-width: 300px;
	}
	.model-note {
		font-size: 0.68rem;
		color: var(--muted);
		margin-top: 25px;
		padding-top: 16px;
		border-top: 1px solid #ddd7bd;
		overflow-wrap: anywhere;
	}
	@media (max-width: 900px) {
		.assistant-grid {
			grid-template-columns: 1fr;
		}
		.assistant-result {
			min-height: 240px;
		}
		.result-empty {
			min-height: 200px;
		}
	}
</style>
