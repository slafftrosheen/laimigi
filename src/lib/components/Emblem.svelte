<script lang="ts">
	import Icon from './Icon.svelte';
	let { avatar = 'leaf', size = 84 }: { avatar?: string; size?: number } = $props();
</script>

<div
	class="emblem"
	class:indigo={avatar === 'crystal'}
	class:amber={avatar === 'compass'}
	style:width={`${size}px`}
	style:height={`${size}px`}
>
	<span><Icon name={avatar} size={size * 0.42} stroke={1.4} /></span>
</div>

<style>
	.emblem {
		flex: none;
		border-radius: 29%;
		background: linear-gradient(140deg, #386c57, #153f39);
		border: 1px solid #bdc99c;
		display: grid;
		place-items: center;
		box-shadow:
			inset 0 0 0 6px #ffffff0b,
			0 8px 24px #163f3915;
		transform: rotate(-6deg);
		color: #efe2b1;
	}
	.emblem span {
		display: grid;
		place-items: center;
		border: 1px solid #eeddaa66;
		width: 75%;
		height: 75%;
		border-radius: 50%;
		transform: rotate(6deg);
	}
	.amber {
		background: linear-gradient(140deg, #ad7542, #694929);
		color: #fff0c6;
		border-color: #d9b674;
	}
	.indigo {
		background: linear-gradient(140deg, #5e668a, #323e66);
		color: #dcdff8;
		border-color: #acb3ce;
	}
</style>
