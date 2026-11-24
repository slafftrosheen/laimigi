<script lang="ts">
	let {
		name = 'spark',
		size = 22,
		stroke = 1.7
	}: { name?: string; size?: number; stroke?: number } = $props();
	const paths: Record<string, string> = {
		spark: 'm12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3Z',
		arrow: 'M5 12h14m-6-6 6 6-6 6',
		back: 'M19 12H5m6-6-6 6 6 6',
		leaf: 'M20 4C8 2 3 8 5 15c2 7 14 7 15-11ZM5 20l10-11',
		compass: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4 6-2.5 5.5L8 16l2.5-5.5L16 8Z',
		crystal: 'm12 2 7 6-3 12H8L5 8l7-6Zm0 0v20M5 8h14M8 20l4-12 4 12',
		school: 'm3 9 9-6 9 6M5 9v11h14V9M9 20v-7h6v7M9 8h6',
		observatory: 'M4 18h16M6 18v-5a6 6 0 0 1 12 0v5M12 7V4m0 0 5-2m-5 2 1 5M3 21h18',
		workshop: 'm14 4 6 6M4 20l4-1L20 7l-3-3L5 16l-1 4Zm-1 2h18',
		library: 'M12 5c-4-3-8-2-10-1v15c4-2 7-1 10 1m0-15c4-3 8-2 10-1v15c-4-2-7-1-10 1V5Z',
		garden: 'M12 22V8M12 14C2 15 2 7 2 5c8 0 10 4 10 9Zm0-5c1-8 7-8 10-7 0 6-3 9-10 7Z',
		tree: 'M12 21v-7m-7 7h14M12 2 5 11h3l-5 6h18l-5-6h3L12 2Z',
		family:
			'M8 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM1 22v-4a7 7 0 0 1 14 0v4m3-10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-2 3a6 6 0 0 1 7 6',
		lock: 'M6 10V7a6 6 0 0 1 12 0v3M4 10h16v12H4V10Zm8 5v3',
		settings:
			'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm-2-6h4l1 4 3 1 3 1v4l-3 1-1 3-1 4h-4l-1-4-3-1-4-1v-4l4-1 1-3 1-4Z',
		check: 'm5 12 4 4L19 6',
		plus: 'M12 4v16M4 12h16',
		mail: 'M3 5h18v14H3V5Zm0 1 9 7 9-7',
		eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
		calendar: 'M4 5h16v16H4V5Zm3-3v6m10-6v6M4 10h16',
		shield: 'm12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6l9-4Zm-4 10 3 3 5-6',
		globe: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM2 12h20M12 2c6 6 6 14 0 20-6-6-6-14 0-20Z',
		clock: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 4v7l4 2',
		key: 'M8 14a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm4-3 9 9m-3-3 3-3m-6 0 3-3',
		copy: 'M8 8h13v13H8V8Zm8-3V2H2v14h3',
		logout: 'M10 3H3v18h7m5-15 6 6-6 6m6-6H8',
		info: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 8v7m0-11v1',
		trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
		menu: 'M3 6h18M3 12h18M3 18h18',
		close: 'm5 5 14 14M19 5 5 19'
	};
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width={stroke}
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	<path d={paths[name] ?? paths.spark} />
</svg>
