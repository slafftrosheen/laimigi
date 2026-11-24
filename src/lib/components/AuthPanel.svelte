<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { getMessages, type Locale } from '#lib/i18n/index';
	import Emblem from './Emblem.svelte';
	import Icon from './Icon.svelte';
	import Notice from './Notice.svelte';
	let {
		mode,
		locale,
		configured,
		form
	}: {
		mode: 'login' | 'signup' | 'forgot' | 'reset';
		locale: Locale;
		configured: boolean;
		form?: { error?: unknown; message?: unknown; success?: unknown } | null;
	} = $props();
	let m = $derived(getMessages(locale));
	let busy = $state(false);
	let reveal = $state(false);
	let title = $derived(
		mode === 'login'
			? m.loginTitle
			: mode === 'signup'
				? m.signupTitle
				: mode === 'forgot'
					? m.forgotTitle
					: m.resetTitle
	);
	let intro = $derived(
		mode === 'login'
			? m.loginIntro
			: mode === 'signup'
				? m.signupIntro
				: mode === 'forgot'
					? m.forgotIntro
					: m.resetIntro
	);
	let submitLabel = $derived(
		mode === 'login'
			? m.signIn
			: mode === 'signup'
				? m.signUp
				: mode === 'forgot'
					? m.sendReset
					: m.resetPassword
	);
</script>

<svelte:head><title>{title} · Laimīgie bērni</title></svelte:head>
<div class="container auth-wrap">
	<aside class="auth-art">
		<div class="eyebrow">LAIMĪGIE BĒRNI</div>
		<h2>{m.familyFirst}</h2>
		<div class="emblem-group">
			<Emblem avatar="leaf" size={88} /><Emblem avatar="compass" size={112} /><Emblem
				avatar="crystal"
				size={88}
			/>
		</div>
		<p>{m.footerNote}</p>
		<div class="auth-art-bottom"><Icon name="leaf" size={19} />{m.gentlePace}</div>
	</aside>
	<section class="auth-panel">
		<a class="text-link back" href={resolve('/')}><Icon name="back" size={16} />{m.backHome}</a>
		<h1>{title}</h1>
		<p class="intro">{intro}</p>
		<Notice {form} {locale} />{#if !configured}<div class="notice">
				<Icon name="info" size={19} />{m.authUnavailable}
			</div>{/if}
		<form
			method="POST"
			use:enhance={() => {
				busy = true;
				return async ({ update }) => {
					await update();
					busy = false;
				};
			}}
		>
			{#if mode !== 'reset'}<label class="field">
					<span>{m.email}</span><input
						name="email"
						type="email"
						autocomplete="email"
						required
						maxlength="254"
						disabled={!configured || busy}
					/>
				</label>{/if}
			{#if mode === 'login' || mode === 'signup' || mode === 'reset'}<label class="field">
					<span>{m.password}</span>
					<div class="password-control">
						<input
							name="password"
							type={reveal ? 'text' : 'password'}
							autocomplete={mode === 'login' ? 'current-password' : 'new-password'}
							required
							minlength={mode === 'login' ? 8 : 12}
							maxlength="128"
							disabled={!configured || busy}
						/><button
							type="button"
							aria-label={reveal ? m.hidePassword : m.showPassword}
							aria-pressed={reveal}
							onclick={() => (reveal = !reveal)}
						>
							<Icon name="eye" size={18} />
						</button>
					</div>
					{#if mode !== 'login'}<small>{m.passwordHint}</small>{/if}
				</label>{/if}
			{#if mode === 'signup'}<input type="hidden" name="locale" value={locale} /><label
					class="check-field"
				>
					<input
						type="checkbox"
						name="adult"
						value="yes"
						required
						disabled={!configured || busy}
					/><span>{m.adultConsent}</span>
				</label>{/if}
			{#if mode === 'login'}<a class="text-link forgot" href={resolve('/auth/forgot')}>
					{m.forgotPassword}
				</a>{/if}
			<button class="btn block" disabled={!configured || busy}>
				{busy ? m.loading : submitLabel}<Icon name="arrow" size={18} />
			</button>
		</form>
		<div class="auth-bottom">
			{#if mode === 'login'}{m.noAccount} <a href={resolve('/auth/signup')}>{m.signUp}</a>{:else}<a
					href={resolve('/auth/login')}
				>
					{m.signIn}
				</a>{/if}
		</div>
	</section>
</div>

<style>
	.auth-wrap {
		display: grid;
		grid-template-columns: 1fr 1fr;
		max-width: 1060px;
		gap: 80px;
		align-items: center;
		padding-top: 60px;
		padding-bottom: 76px;
	}
	.auth-art {
		background: #e7ecdc;
		border: 1px solid #d5ddc6;
		border-radius: 24px;
		padding: 40px 32px;
		min-height: 500px;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
	}
	.auth-art h2 {
		font-size: 2.4rem;
		max-width: 340px;
		margin-top: 24px;
		line-height: 1.2;
	}
	.auth-art > p {
		font-size: 0.81rem;
		color: var(--muted);
		max-width: 250px;
	}
	.emblem-group {
		display: flex;
		gap: 14px;
		align-items: center;
		padding: 55px 0;
	}
	.emblem-group > :global(:first-child) {
		margin-top: 50px;
	}
	.emblem-group > :global(:last-child) {
		margin-top: 25px;
	}
	.auth-art-bottom {
		display: flex;
		gap: 8px;
		align-items: center;
		padding-top: 35px;
		font-size: 0.72rem;
		color: #7a886b;
	}
	.auth-panel h1 {
		font-size: 2.8rem;
		margin-top: 27px;
		margin-bottom: 14px;
	}
	.intro {
		font-size: 0.86rem;
		color: var(--muted);
		margin-bottom: 26px;
	}
	.back {
		font-size: 0.7rem;
	}
	.auth-bottom {
		margin-top: 24px;
		font-size: 0.76rem;
		text-align: center;
		color: var(--muted);
		line-height: 1.8;
	}
	.auth-bottom a {
		color: var(--forest-2);
		font-weight: 650;
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.password-control {
		display: flex;
		position: relative;
	}
	.password-control input {
		padding-right: 45px;
	}
	.password-control button {
		position: absolute;
		right: 4px;
		top: 4px;
		height: 38px;
		width: 38px;
		border: 0;
		background: transparent;
		display: grid;
		place-items: center;
		color: var(--muted);
	}
	.forgot {
		font-size: 0.73rem;
		margin: -4px 0 23px;
		display: flex;
		width: max-content;
		margin-left: auto;
	}
	@media (max-width: 900px) {
		.auth-wrap {
			gap: 35px;
		}
		.auth-art {
			padding-inline: 20px;
		}
		.auth-art h2 {
			font-size: 2rem;
		}
		.emblem-group {
			gap: 0;
			transform: scale(0.85);
		}
		.auth-panel h1 {
			font-size: 2.4rem;
		}
	}
	@media (max-width: 700px) {
		.auth-wrap {
			grid-template-columns: 1fr;
			max-width: 500px;
			padding-top: 35px;
			gap: 20px;
		}
		.auth-art {
			display: none;
		}
		.auth-panel h1 {
			font-size: 2.8rem;
		}
	}
</style>
