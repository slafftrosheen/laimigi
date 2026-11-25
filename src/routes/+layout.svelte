<script lang="ts">
	import { resolve } from '$app/paths';
	import '../app.css';
	import favicon from '#lib/assets/favicon.svg';
	import Icon from '#lib/components/Icon.svelte';
	import { getMessages, locales, localeNames } from '#lib/i18n/index';
	import { page } from '$app/state';
	import type { LayoutProps } from './$types';
	let { data, children }: LayoutProps = $props();
	let m = $derived(getMessages(data.locale));
	let menuOpen = $state(false);
	let isGame = $derived(
		Boolean(data.childMode) ||
			page.url.pathname.startsWith('/play/') ||
			page.url.pathname.startsWith('/learn/')
	);
	let isStaff = $derived(['teacher', 'admin', 'root_admin'].includes(data.role ?? ''));
</script>

<svelte:head>
	<link rel="icon" href={favicon} /><meta name="theme-color" content="#183e35" />
</svelte:head>
<a class="skip-link" href="#main">{m.skip}</a>
<div class="container">
	<header class="site-header">
		<a
			class="brand"
			href={data.childMode
				? resolve('/play/[heroId]', { heroId: data.childMode.heroId })
				: resolve('/')}
			aria-label={data.childMode ? m.worldTitle : m.home}
		>
			<span class="brand-icon"><Icon name="garden" size={24} /></span><span>
				<strong>{m.brand}</strong><small>Daugavpils · Latvija</small>
			</span>
		</a>
		{#if !isGame}<nav class="nav" class:mobile-open={menuOpen} aria-label={m.navigation}>
				<a
					href={resolve('/')}
					class:active={page.url.pathname === '/'}
					onclick={() => (menuOpen = false)}
				>
					{m.home}
				</a>
				{#if data.user}<a
						href={resolve('/family')}
						class:active={page.url.pathname.startsWith('/family')}
						onclick={() => (menuOpen = false)}
					>
						{m.family}
					</a>{/if}
				<a
					href={resolve('/learn')}
					class:active={page.url.pathname.startsWith('/learn')}
					onclick={() => (menuOpen = false)}
				>
					{m.learn}
				</a>
				{#if isStaff}<a
						href={resolve('/studio')}
						class:active={page.url.pathname.startsWith('/studio')}
						onclick={() => (menuOpen = false)}
					>
						{m.studio}
					</a>{/if}
				{#if data.role === 'root_admin'}<a
						href={resolve('/admin')}
						class:active={page.url.pathname.startsWith('/admin')}
						onclick={() => (menuOpen = false)}
					>
						{m.admin}
					</a>{/if}
			</nav>{:else}<a class="game-exit text-link" href={resolve('/auth/adult?next=/family')}>
				<Icon name="lock" size={16} />{m.adultArea}
			</a>{/if}
		<div class="header-actions">
			<form action="/locale" method="POST" class="locale-switch" aria-label={m.language}>
				<input
					type="hidden"
					name="next"
					value={page.url.pathname + page.url.search}
				/>{#each locales as locale (locale)}<button
						name="locale"
						value={locale}
						lang={locale}
						aria-label={localeNames[locale]}
						aria-pressed={data.locale === locale}
					>
						{locale.toUpperCase()}
					</button>{/each}
			</form>
			{#if data.user}<form method="POST" action="/auth/logout">
					<button class="btn secondary small" aria-label={m.signOut}>
						<Icon name="logout" size={17} /><span class="auth-link">{m.signOut}</span>
					</button>
				</form>{:else if !data.childMode}<a
					class="btn small auth-link"
					href={resolve('/auth/login')}
				>
					{m.signIn}<Icon name="arrow" size={16} />
				</a>{/if}
			{#if !isGame}<button
					class="mobile-toggle"
					aria-label={menuOpen ? m.close : m.menu}
					aria-expanded={menuOpen}
					onclick={() => (menuOpen = !menuOpen)}
				>
					<Icon name={menuOpen ? 'close' : 'menu'} size={23} />
				</button>{/if}
		</div>
	</header>
</div>
<main id="main">{@render children()}</main>
<div class="container">
	<footer class="site-footer">
		<div>
			<strong>{m.footer}</strong>
			<p>{m.footerNote}</p>
		</div>
		<div class="footer-mark"><Icon name="leaf" size={27} /></div>
		<span>© {new Date().getFullYear()} Laimīgie bērni</span>
	</footer>
</div>

<style>
	.game-exit {
		margin-left: auto;
	}
	@media (max-width: 600px) {
		.game-exit {
			font-size: 0.65rem;
			gap: 4px;
		}
	}
</style>
