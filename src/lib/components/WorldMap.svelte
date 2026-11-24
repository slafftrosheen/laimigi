<script lang="ts">
	import { locationKeys, getMessages, type Locale, type LocationKey } from '#lib/i18n/index';
	let {
		locale = 'lv',
		active = '',
		onselect,
		compact = false
	}: {
		locale?: Locale;
		active?: string;
		onselect?: (key: LocationKey) => void;
		compact?: boolean;
	} = $props();
	let m = $derived(getMessages(locale));
	const positions: Record<LocationKey, [number, number]> = {
		school: [25, 26],
		observatory: [77, 21],
		workshop: [19, 65],
		library: [80, 65],
		garden: [47, 80],
		tree: [52, 42]
	};
</script>

<div class="map" class:compact>
	<svg viewBox="0 0 760 560" role="img" aria-label={m.worldMap}>
		<defs>
			<linearGradient id="land" x2="0" y2="1">
				<stop stop-color="#dbe7cf" /><stop offset="1" stop-color="#b3c8a4" />
			</linearGradient><linearGradient id="roof" x2=".9" y2="1">
				<stop stop-color="#4b8174" /><stop offset="1" stop-color="#235e55" />
			</linearGradient><pattern
				id="dots"
				x="0"
				y="0"
				width="22"
				height="22"
				patternUnits="userSpaceOnUse"
			>
				<circle cx="5" cy="5" r=".65" fill="#365e46" opacity=".15" />
			</pattern><filter id="shadow">
				<feDropShadow dx="0" dy="7" stdDeviation="6" flood-color="#214333" flood-opacity=".12" />
			</filter>
		</defs>
		<rect width="760" height="560" rx="34" fill="#eaf0dd" /><path
			d="M-15 161C95 116 67 55 189 43S373 72 452 34 682-5 773 64V552H-15Z"
			fill="url(#land)"
		/><rect width="760" height="560" rx="34" fill="url(#dots)" />
		<path
			d="M-25 331C66 260 121 355 201 313S352 312 380 394 439 449 526 418 685 460 786 420"
			fill="none"
			stroke="#819f9d"
			stroke-width="43"
		/><path
			d="M-25 326C66 255 121 350 201 308S352 307 380 389 439 444 526 413 685 455 786 415"
			fill="none"
			stroke="#a5c5bd"
			stroke-width="33"
		/><path
			d="M-25 323C66 252 121 347 201 305S352 304 380 386 439 441 526 410 685 452 786 412"
			fill="none"
			stroke="#e6ede1"
			stroke-width="2"
			stroke-dasharray="25 16"
			opacity=".7"
		/>
		<path
			d="m187 202 77 65 130-22 183-63M122 361l141-94m131-22 220 114M394 245l-22 200"
			fill="none"
			stroke="#f1e4bc"
			stroke-width="22"
			stroke-linecap="round"
		/><path
			d="m187 202 77 65 130-22 183-63M122 361l141-94m131-22 220 114M394 245l-22 200"
			fill="none"
			stroke="#e2cea1"
			stroke-width="2"
			stroke-dasharray="3 10"
		/>
		<g fill="#7d9b67" opacity=".38">
			<ellipse cx="183" cy="219" rx="82" ry="18" /><ellipse
				cx="577"
				cy="177"
				rx="80"
				ry="19"
			/><ellipse cx="134" cy="385" rx="85" ry="20" /><ellipse
				cx="617"
				cy="389"
				rx="90"
				ry="18"
			/><ellipse cx="393" cy="284" rx="91" ry="22" />
		</g>
		<!-- House of knowledge -->
		<g filter="url(#shadow)">
			<path d="M121 137h126v74H121Z" fill="#f6e9c5" /><path
				d="m108 143 79-61 75 61Z"
				fill="url(#roof)"
			/><path d="m120 141 67-49 62 49" fill="none" stroke="#8fa28a" stroke-width="3" /><path
				d="M166 166q20-24 39 0v45h-39Z"
				fill="#9c7950"
			/><path d="M133 156h21v23h-21m63-23h21v23h-21" fill="#d9ba78" /><path
				d="M132 165h23m-12-11v27m63-16h22m-11-11v27"
				stroke="#8a8261"
				stroke-width="2"
			/><path d="M170 209h33v8h-33" fill="#ae9870" /><path
				d="M170 101v-20l17-13 17 13v20"
				fill="#e9d7a8"
			/><path d="m164 80 23-20 24 20Z" fill="#26594f" /><circle
				cx="187"
				cy="88"
				r="8"
				fill="#f7eed3"
				stroke="#9a8858"
			/><path d="M187 82v6l4 2" stroke="#516b55" fill="none" />
		</g>
		<!-- Observatory -->
		<g filter="url(#shadow)">
			<path d="M520 128h113v56H520Z" fill="#e8cea0" /><path
				d="M517 130a60 60 0 0 1 120 0Z"
				fill="#b88c43"
			/><path d="M545 128c0-58 57-58 57 0" fill="#d5aa58" /><path
				d="M572 77v53"
				stroke="#f0cd7b"
				stroke-width="3"
			/><path d="m566 75 38-36 13 13-41 31" fill="#3d7068" stroke="#c9b16c" stroke-width="3" /><path
				d="m600 40 12-9 15 17-12 10"
				fill="#315c54"
			/><path d="M562 158q13-15 27 0v26h-27" fill="#486d5b" /><circle
				cx="537"
				cy="151"
				r="8"
				fill="#fff0bf"
			/><circle cx="617" cy="151" r="8" fill="#fff0bf" /><path
				d="M512 183h130v9H512"
				fill="#b39765"
			/>
		</g>
		<!-- Workshop -->
		<g filter="url(#shadow)">
			<path d="M64 335h132v53H64Z" fill="#ebc6a0" /><path
				d="m48 337 80-54 84 54Z"
				fill="#a35e49"
			/><path d="m70 322 58-30 59 30" fill="none" stroke="#cf9071" stroke-width="3" /><path
				d="M89 354h28v22H89m34-22h28v22h-28"
				fill="#f4e6c2"
			/><path d="M160 353h22v35h-22" fill="#817456" /><path
				d="M71 389h128"
				stroke="#917a53"
				stroke-width="6"
			/><path d="M177 291v25h16v-25" fill="#b4a180" /><path
				d="M95 378v-22m40 22v-22"
				stroke="#a38a66"
				stroke-width="2"
			/>
		</g>
		<!-- Library -->
		<g filter="url(#shadow)">
			<path d="M546 327h137v61H546Z" fill="#f3e3bc" /><path
				d="m529 328 79-55 92 55Z"
				fill="#496b60"
			/><path d="m548 322 61-37 70 37" fill="none" stroke="#789582" stroke-width="3" /><path
				d="M558 343h28v28h-28m57-28h28v28h-28"
				fill="#caa665"
			/><path d="M593 351q8-10 16 0v37h-16" fill="#9f7b4d" /><path
				d="M550 386h137v9H550"
				fill="#b49e75"
			/><path d="M609 303v-19" stroke="#d4c7a0" stroke-width="2" /><path
				d="M590 298q10-6 19 0 10-6 19 0v16q-10-6-19 0-10-6-19 0Z"
				fill="#e8d7ac"
			/>
		</g>
		<!-- Garden -->
		<g filter="url(#shadow)">
			<path
				d="M304 468h125v-58l-63-38-62 38Z"
				fill="#d1dfbd"
				stroke="#6b8d6c"
				stroke-width="3"
			/><path
				d="m304 410 62 14 63-14m-63-38v96m-31-77v77m62-77v77M304 440h125"
				fill="none"
				stroke="#91ab86"
				stroke-width="3"
			/><path
				d="M350 468v-32q16-16 32 0v32"
				fill="#c5d4af"
				stroke="#6b8d6c"
				stroke-width="2"
			/><path
				d="M310 462c-12-20-3-34 6-24 4-28 16-28 17-2 14-11 14 16 1 26m64 0c-15-16-6-31 2-19 1-28 18-25 14-4 14-14 18 5 4 23"
				fill="#6e965b"
			/>
		</g>
		<!-- Meeting tree -->
		<g filter="url(#shadow)">
			<path d="M383 279c7-39-2-60-12-84h25c-2 23 8 40 13 84Z" fill="#907349" /><path
				d="m385 238-32-28m39 21 32-30"
				stroke="#907349"
				stroke-width="10"
			/><path
				d="M345 218c-31-15-24-54 1-56-7-30 28-49 50-30 28-24 63-2 54 27 36 10 28 53-2 57-22 19-82 20-103 2Z"
				fill="#63834f"
			/><path
				d="M349 198c-22-17-9-35 9-33 0-20 21-31 37-15 17-17 44-9 41 11 26 8 25 31 6 38-24 8-66 13-93-1Z"
				fill="#829e59"
			/><path d="M364 176c-7-20 18-29 32-16 20-17 35-3 29 11" fill="#a1b86e" /><path
				d="M351 279h89m-80 0v10m71-10v10"
				stroke="#9f8151"
				stroke-width="7"
			/><circle cx="367" cy="208" r="3" fill="#dcc579" /><circle
				cx="423"
				cy="193"
				r="3"
				fill="#dcc579"
			/>
		</g>
		<!-- Bridge and landscape details -->
		<path d="m356 359 29-7 19 70-29 7Z" fill="#bc9b67" stroke="#8b794f" stroke-width="3" /><path
			d="m362 371 28-7m-24 19 27-7m-24 19 28-7m-25 19 28-7"
			stroke="#e2c893"
			stroke-width="3"
		/>
		{#each [[68, 142], [293, 94], [683, 258], [271, 438], [60, 461], [688, 475], [454, 102], [715, 141], [96, 229], [480, 318]] as [x, y] (x)}
			<g transform={`translate(${x},${y})`}>
				<path d="M0 21v23" stroke="#8e865c" stroke-width="4" /><ellipse
					cx="0"
					cy="7"
					rx="16"
					ry="24"
					fill="#759765"
				/><ellipse cx="-3" cy="2" rx="11" ry="19" fill="#91ad77" />
			</g>{/each}
		{#each [[245, 176], [470, 382], [192, 460], [671, 212], [284, 339], [496, 244], [98, 487], [695, 335]] as [x, y] (x)}<g
				transform={`translate(${x},${y})`}
			>
				<path d="M-9 0q5-14 10 0 5-10 9 0" stroke="#709356" stroke-width="3" fill="none" /><circle
					cx="0"
					cy="-5"
					r="3"
					fill="#ebc785"
				/>
			</g>{/each}
		<path
			d="m684 50 5 13 14 5-14 5-5 14-5-14-14-5 14-5Z"
			fill="none"
			stroke="#728c69"
			stroke-width="1.5"
		/><path d="M684 49v37m-18-18h37" stroke="#728c69" stroke-width=".8" /><circle
			cx="684"
			cy="68"
			r="24"
			fill="none"
			stroke="#728c69"
			stroke-width=".8"
			opacity=".55"
		/>
	</svg>
	{#if onselect}{#each locationKeys as key, i (key)}<button
				class="map-pin"
				class:selected={active === key}
				style:left={`${positions[key][0]}%`}
				style:top={`${positions[key][1]}%`}
				aria-label={`${i + 1}. ${m[key]}`}
				aria-pressed={active === key}
				onclick={() => onselect?.(key)}
			>
				{i + 1}
			</button>{/each}{/if}
</div>

<style>
	.map {
		position: relative;
		width: 100%;
		line-height: 0;
	}
	.map svg {
		display: block;
		width: 100%;
		height: auto;
		border-radius: var(--radius-lg);
	}
	.map-pin {
		position: absolute;
		transform: translate(-50%, -50%);
		width: 42px;
		height: 42px;
		padding: 0;
		background: #fff3cc;
		color: #183e35;
		border: 3px solid #376958;
		border-radius: 50%;
		font-family: var(--font-body);
		font-weight: 800;
		font-size: 15px;
		box-shadow:
			0 3px 0 #173b32,
			0 6px 16px #133d3536;
		transition:
			transform 0.15s,
			background 0.15s;
		cursor: pointer;
	}
	.map-pin:hover,
	.map-pin.selected {
		background: #eac172;
		transform: translate(-50%, -50%) scale(1.13);
	}
	.map-pin.selected {
		box-shadow:
			0 0 0 5px #fff3cc66,
			0 3px 0 #173b32;
	}
	.compact {
		pointer-events: none;
	}
	@media (max-width: 600px) {
		.map-pin {
			width: 36px;
			height: 36px;
			font-size: 13px;
			border-width: 2px;
		}
	}
</style>
