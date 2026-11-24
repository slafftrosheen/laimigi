<script lang="ts">
	import { resolve } from '$app/paths';
	import Icon from '#lib/components/Icon.svelte';
	import WorldMap from '#lib/components/WorldMap.svelte';
	import { getMessages, locationKeys } from '#lib/i18n/index';
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
	let m = $derived(getMessages(data.locale));
</script>

<svelte:head>
	<title>Laimīgie bērni — {m.home}</title><meta name="description" content={m.heroDescription} />
</svelte:head>
<section class="hero container">
	<div class="hero-copy">
		<div class="eyebrow">
			<span class="little-sun"><Icon name="spark" size={17} /></span>{m.eyebrow}
		</div>
		<h1>{m.heroTitle}</h1>
		<p>{m.heroDescription}</p>
		<div class="actions">
			<a class="btn" href={resolve(data.user ? '/family' : '/auth/signup')}>
				{data.user ? m.family : m.signUp}<Icon name="arrow" size={19} />
			</a>
		</div>
		<a class="hero-secondary" href="#world">{m.exploreWorld}<Icon name="arrow" size={16} /></a>
		<div class="hero-details">
			<span><Icon name="family" size={16} />{m.ages}</span><span>
				<Icon name="globe" size={16} />{m.languages}
			</span>
		</div>
	</div>
	<div class="hero-art">
		<div class="art-label">
			<span class="eyebrow">LAIMĪGIE BĒRNI</span><Icon name="compass" size={23} />
		</div>
		<WorldMap locale={data.locale} compact />
		<div class="art-bottom">
			<span><Icon name="leaf" size={17} />{m.gentlePace}</span><span class="chapter">01 / 06</span>
		</div>
	</div>
</section>
<div class="container">
	<div class="intro-ribbon">
		<span class="ribbon-symbol"><Icon name="spark" size={22} /></span>
		<p>{m.familyFirst}</p>
		<span class="muted small">{m.heroNote}</span>
	</div>
</div>
<section class="container places-section" id="world">
	<div class="section-heading">
		<div>
			<div class="eyebrow">01 / {m.exploreWorld}</div>
			<h2>{m.possibilities}</h2>
		</div>
		<p>{m.possibilitiesText}</p>
	</div>
	<div class="places-grid">
		{#each locationKeys as place, i (place)}<a
				class="place-card"
				href={resolve(`/learn?location=${place}`)}
			>
				<span class="place-num">0{i + 1}</span>
				<div class="place-icon"><Icon name={place} size={31} stroke={1.3} /></div>
				<h3>{m[place]}</h3>
				<p>{m[`${place}Description`]}</p>
				<span class="place-arrow"><Icon name="arrow" size={18} /></span>
			</a>{/each}
	</div>
</section>
<section class="container journey-section">
	<div class="eyebrow">02 / {m.family}</div>
	<h2>{m.pathTitle}</h2>
	<div class="journey-grid">
		{#each [[m.path1, m.path1Body, 'family'], [m.path2, m.path2Body, 'compass'], [m.path3, m.path3Body, 'school']] as [title, body, icon], i (icon)}<div
				class="journey-step"
			>
				<div class="journey-top"><span>0{i + 1}</span><Icon name={icon} size={24} /></div>
				<h3>{title}</h3>
				<p>{body}</p>
			</div>{/each}
	</div>
</section>
<section class="container future-wrap">
	<div class="future-panel">
		<Icon name="tree" size={56} stroke={1.2} />
		<div>
			<h2>{m.futureTitle}</h2>
			<p>{m.futureBody}</p>
		</div>
		<a class="btn gold" href={resolve(data.user ? '/family' : '/auth/signup')}>
			{data.user ? m.family : m.signUp}<Icon name="arrow" size={18} />
		</a>
	</div>
</section>

<style>
	.hero {
		display: grid;
		grid-template-columns: 1fr 1.15fr;
		gap: 54px;
		align-items: center;
		padding-top: 60px;
		padding-bottom: 58px;
	}
	.hero-copy h1 {
		margin: 22px 0 22px;
		font-size: clamp(3rem, 4.7vw, 4.5rem);
		max-width: 530px;
	}
	.hero-copy > p {
		font-size: 0.91rem;
		color: var(--muted);
		max-width: 440px;
		margin-bottom: 28px;
		line-height: 1.8;
	}
	.little-sun {
		color: #a78342;
		display: flex;
	}
	.hero-secondary {
		display: inline-flex;
		gap: 9px;
		align-items: center;
		font-size: 0.78rem;
		color: var(--forest-2);
		margin-top: 17px;
		padding: 4px 0;
		border-bottom: 1px solid #b7c2aa;
	}
	.hero-details {
		display: flex;
		gap: 22px;
		margin-top: 31px;
		color: #798174;
		font-size: 0.61rem;
		letter-spacing: 0.08em;
		font-weight: 650;
	}
	.hero-details span {
		display: flex;
		align-items: center;
		gap: 7px;
	}
	.hero-art {
		background: #e8ecdd;
		border: 1px solid #d5dcc7;
		border-radius: 18px;
		padding: 18px;
		transform: rotate(1deg);
		box-shadow: 0 22px 50px #2445310b;
	}
	.art-label {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 7px 14px;
		color: #7c8a6f;
	}
	.art-label .eyebrow {
		font-size: 0.58rem;
		letter-spacing: 0.19em;
	}
	.art-bottom {
		padding: 16px 7px 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		font-size: 0.65rem;
		color: #65765d;
	}
	.art-bottom > span:first-child {
		display: flex;
		gap: 8px;
		align-items: center;
	}
	.chapter {
		font-family: var(--font-display);
		font-size: 0.8rem;
		font-style: italic;
		color: #8a957e;
	}
	.intro-ribbon {
		display: flex;
		align-items: center;
		gap: 18px;
		border-block: 1px solid var(--line);
		padding: 23px 0;
	}
	.ribbon-symbol {
		color: #ae8c50;
		display: flex;
	}
	.intro-ribbon p {
		font-family: var(--font-display);
		font-size: 1.12rem;
		letter-spacing: -0.02em;
	}
	.intro-ribbon > .muted {
		margin-left: auto;
		font-size: 0.7rem;
	}
	.places-section {
		padding-top: 70px;
		padding-bottom: 70px;
		scroll-margin-top: 30px;
	}
	.section-heading .eyebrow {
		margin-bottom: 14px;
	}
	.section-heading h2 {
		font-size: 2.5rem;
		max-width: 500px;
	}
	.section-heading > p {
		max-width: 320px;
		color: var(--muted);
		font-size: 0.82rem;
		line-height: 1.8;
	}
	.places-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		border-top: 1px solid var(--line);
		border-left: 1px solid var(--line);
		margin-top: 34px;
	}
	.place-card {
		padding: 27px 29px 30px;
		border-right: 1px solid var(--line);
		border-bottom: 1px solid var(--line);
		position: relative;
		background: #f4f4e9;
		transition: background 0.2s;
	}
	.place-card:nth-child(2n) {
		background: #edf0e3;
	}
	.place-card:hover {
		background: #e4ead7;
	}
	.place-num {
		position: absolute;
		right: 25px;
		top: 26px;
		font-family: var(--font-display);
		font-size: 0.82rem;
		font-style: italic;
		color: #98a18b;
	}
	.place-icon {
		width: 61px;
		height: 61px;
		color: #55724d;
		display: flex;
		align-items: center;
		margin-bottom: 13px;
	}
	.place-card h3 {
		font-family: var(--font-display);
		font-size: 1.5rem;
		font-weight: 400;
		margin-bottom: 9px;
	}
	.place-card p {
		font-size: 0.76rem;
		color: var(--muted);
		max-width: 235px;
		min-height: 43px;
		padding-right: 10px;
	}
	.place-arrow {
		display: flex;
		margin-top: 16px;
		color: #778862;
	}
	.journey-section {
		padding-top: 15px;
		padding-bottom: 64px;
	}
	.journey-section h2 {
		margin-top: 15px;
	}
	.journey-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 50px;
		margin-top: 32px;
	}
	.journey-top {
		display: flex;
		justify-content: space-between;
		border-bottom: 1px solid var(--line);
		padding: 15px 0;
		margin-bottom: 19px;
		color: #879779;
	}
	.journey-top > span {
		font-family: var(--font-display);
		font-style: italic;
		font-size: 1.5rem;
		color: #b3b99e;
	}
	.journey-step h3 {
		font-size: 1rem;
		margin-bottom: 11px;
	}
	.journey-step p {
		font-size: 0.8rem;
		color: var(--muted);
	}
	.future-wrap {
		padding-bottom: 68px;
	}
	.future-panel {
		background: var(--forest);
		border-radius: 16px;
		padding: 38px;
		display: flex;
		align-items: center;
		gap: 29px;
		color: #d7c28d;
	}
	.future-panel > :global(svg) {
		flex: none;
	}
	.future-panel > div {
		flex: 1;
	}
	.future-panel h2 {
		font-size: 1.9rem;
		color: #f6eed4;
		margin-bottom: 9px;
	}
	.future-panel p {
		color: #c0cbb7;
		font-size: 0.79rem;
		max-width: 550px;
	}
	.future-panel > .btn {
		flex: none;
		max-width: 230px;
	}
	@media (max-width: 1100px) {
		.hero {
			gap: 30px;
		}
		.hero-copy h1 {
			font-size: 3.6rem;
		}
		.future-panel {
			flex-wrap: wrap;
		}
		.future-panel > .btn {
			margin-left: 84px;
		}
		.intro-ribbon > .muted {
			max-width: 240px;
		}
	}
	@media (max-width: 800px) {
		.hero {
			grid-template-columns: 1fr;
			padding-top: 40px;
			gap: 30px;
		}
		.hero-copy h1 {
			max-width: 650px;
			font-size: 3.8rem;
		}
		.hero-copy > p {
			max-width: 600px;
		}
		.hero-art {
			max-width: 680px;
		}
		.intro-ribbon {
			flex-wrap: wrap;
			gap: 12px;
		}
		.intro-ribbon > .muted {
			max-width: none;
			margin-left: 35px;
			width: 100%;
		}
		.places-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.journey-grid {
			gap: 23px;
		}
		.section-heading > p {
			max-width: 500px;
		}
		.places-section {
			padding-top: 50px;
		}
		.journey-step h3 {
			font-size: 0.9rem;
		}
	}
	@media (max-width: 560px) {
		.hero-copy h1 {
			font-size: 3.2rem;
		}
		.hero {
			padding-bottom: 35px;
		}
		.hero-art {
			padding: 12px;
			transform: none;
		}
		.art-bottom {
			font-size: 0.59rem;
		}
		.places-grid {
			grid-template-columns: 1fr 1fr;
		}
		.place-card {
			padding: 20px 16px;
		}
		.place-card h3 {
			font-size: 1.3rem;
		}
		.place-card p {
			font-size: 0.72rem;
		}
		.place-num {
			right: 15px;
			top: 20px;
		}
		.place-icon {
			height: 49px;
		}
		.journey-grid {
			grid-template-columns: 1fr;
			gap: 20px;
		}
		.journey-top {
			margin-bottom: 13px;
		}
		.future-panel {
			padding: 27px;
			gap: 18px;
		}
		.future-panel > div {
			flex-basis: 100%;
		}
		.future-panel > .btn {
			margin-left: 0;
			max-width: none;
			width: 100%;
		}
		.future-panel > :global(svg) {
			width: 38px;
			height: 38px;
		}
		.section-heading h2 {
			font-size: 2.2rem;
		}
		.future-wrap {
			padding-bottom: 40px;
		}
		.intro-ribbon p {
			font-size: 1rem;
		}
		.hero-details {
			gap: 20px;
		}
	}
</style>
