<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { getMessages } from '#lib/i18n/index';
	import Icon from '#lib/components/Icon.svelte';
	import Notice from '#lib/components/Notice.svelte';
	import type { PageProps } from './$types';
	let { data, form }: PageProps = $props();
	let m = $derived(getMessages(data.locale));
	let busy = $state(false);
	let reveal = $state(false);
</script>

<svelte:head><title>{m.adultArea} · Laimīgie bērni</title></svelte:head>
<div class="container adult-unlock">
	<section class="panel unlock-panel">
		<div class="unlock-symbol"><Icon name="shield" size={33} stroke={1.3} /></div>
		<div class="eyebrow">{m.adultArea}</div>
		<h1>{m.adultUnlockTitle}</h1>
		<p class="unlock-intro">{m.adultUnlockIntro}</p>
		<Notice {form} locale={data.locale} />
		<form
			method="POST"
			use:enhance={() => {
				busy = true;
				return async ({ update }) => {
					try {
						await update();
					} finally {
						busy = false;
					}
				};
			}}
		>
			<input type="hidden" name="next" value={data.next} />
			<div class="field">
				<label for="adult-password">{m.password}</label>
				<div class="password-input">
					<input
						id="adult-password"
						name="password"
						type={reveal ? 'text' : 'password'}
						autocomplete="current-password"
						minlength="1"
						maxlength="128"
						required
						disabled={busy}
						aria-describedby="adult-password-hint"
					/><button
						type="button"
						aria-label={reveal ? m.hidePassword : m.showPassword}
						aria-pressed={reveal}
						onclick={() => (reveal = !reveal)}
					>
						<Icon name="eye" size={18} />
					</button>
				</div>
				<small id="adult-password-hint">{m.adultPasswordHint}</small>
			</div>
			<button class="btn block" disabled={busy}>
				{busy ? m.loading : m.confirmAdult}<Icon name="key" size={18} />
			</button>
		</form>
		<div class="unlock-bottom">
			{#if data.childMode}<a
					class="text-link"
					href={resolve('/play/[heroId]', { heroId: data.childMode.heroId })}
				>
					<Icon name="back" size={16} />{m.returnToWorld}
				</a>{/if}
			<form method="POST" action="/auth/logout">
				<button type="submit" class="text-link"><Icon name="logout" size={16} />{m.signOut}</button>
			</form>
		</div>
	</section>
</div>

<style>
	.adult-unlock {
		max-width: 580px;
		padding-top: 56px;
		padding-bottom: 70px;
	}
	.unlock-panel {
		padding: 39px;
	}
	.unlock-symbol {
		display: grid;
		place-items: center;
		width: 68px;
		height: 76px;
		background: #e7ecdc;
		border: 1px solid #ccd6ba;
		border-radius: 22px 22px 32px 32px;
		color: #4f7250;
		margin-bottom: 28px;
	}
	.unlock-panel h1 {
		font-size: 2.7rem;
		margin: 14px 0 18px;
		overflow-wrap: anywhere;
	}
	.unlock-intro {
		color: var(--muted);
		font-size: 0.86rem;
		margin-bottom: 28px;
	}
	.field > label {
		font-size: 0.78rem;
		font-weight: 650;
	}
	.password-input {
		position: relative;
	}
	.password-input input {
		padding-right: 45px;
	}
	.password-input button {
		position: absolute;
		right: 4px;
		top: 4px;
		width: 38px;
		height: 38px;
		display: grid;
		place-items: center;
		border: 0;
		border-radius: 6px;
		background: transparent;
		color: var(--muted);
	}
	.unlock-bottom {
		display: flex;
		flex-wrap: wrap;
		gap: 20px;
		justify-content: space-between;
		border-top: 1px solid var(--line);
		padding-top: 23px;
		margin-top: 27px;
		font-size: 0.72rem;
	}
	.unlock-bottom button {
		border: 0;
		background: transparent;
		padding: 0;
		font: inherit;
	}
	@media (max-width: 600px) {
		.adult-unlock {
			padding-top: 25px;
		}
		.unlock-panel {
			padding: 26px;
		}
		.unlock-panel h1 {
			font-size: 2.3rem;
		}
	}
</style>
