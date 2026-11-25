<script lang="ts">
	import { enhance } from '$app/forms';
	import { tick, untrack } from 'svelte';
	import { formatMessage, getMessages, type Locale } from '#lib/i18n/index';
	import { savedBlockIds } from '#lib/learning/presentation';
	import type { BlockProgress, Lesson, LessonProgress, StepResult } from '#lib/types';
	import Icon from './Icon.svelte';
	let {
		lesson,
		locale,
		heroId = null,
		blockProgress = [],
		progress,
		form,
		preview = false,
		rewardEarned = false
	}: {
		lesson: Lesson;
		locale: Locale;
		heroId?: string | null;
		blockProgress?: BlockProgress[];
		progress?: LessonProgress;
		form?: {
			error?: unknown;
			message?: unknown;
			block_id?: string;
			hero_id?: string;
			stepResult?: StepResult;
		} | null;
		preview?: boolean;
		rewardEarned?: boolean;
	} = $props();
	let m = $derived(getMessages(locale));
	let busy = $state(false);
	let requestedIndex = $state<number | null>(null);
	let selectedOption = $state('');
	const alreadyRewarded = untrack(() => rewardEarned);
	let stepHeading: HTMLHeadingElement | undefined = $state();
	let savedIds = $derived(savedBlockIds(blockProgress, lesson, heroId));
	let firstMissing = $derived(lesson.blocks.findIndex((block) => !savedIds.has(block.id)));
	let frontier = $derived(firstMissing < 0 ? lesson.blocks.length : firstMissing);
	let activeIndex = $derived(
		Math.max(0, Math.min(requestedIndex ?? frontier, lesson.blocks.length - 1))
	);
	let current = $derived(lesson.blocks[activeIndex]);
	let currentSaved = $derived(Boolean(current && savedIds.has(current.id)));
	let allSaved = $derived(savedIds.size === lesson.blocks.length);
	let completed = $derived(
		progress?.status === 'completed' && progress.content_version === lesson.content_version
	);
	let feedback = $derived(
		form?.block_id === current?.id && form?.hero_id === heroId ? form.stepResult : undefined
	);
	let canWrite = $derived(Boolean(heroId) && !preview);
	let justEarned = $derived(
		completed && rewardEarned && !alreadyRewarded && form?.message === 'lesson_completed'
	);
	async function moveTo(index: number) {
		requestedIndex = index;
		selectedOption = '';
		await tick();
		stepHeading?.focus();
	}
	function label(type: string) {
		return type === 'reading'
			? m.readingBlock
			: type === 'choice'
				? m.choiceBlock
				: m.reflectionBlock;
	}
</script>

<section class="lesson-player" class:preview aria-label={preview ? m.previewLabel : m.lessonSteps}>
	{#if preview}<div class="player-preview-note">
			<Icon name="eye" size={18} /><span>{m.previewHint}</span>
		</div>{/if}
	{#if lesson.blocks.length}
		<div class="player-topline">
			<span>
				{formatMessage(m.stepPosition, { current: activeIndex + 1, total: lesson.blocks.length })}
			</span>
			{#if canWrite}<span>
					<Icon name="check" size={14} />{formatMessage(m.stepsSaved, {
						completed: savedIds.size,
						total: lesson.blocks.length
					})}
				</span>{/if}
		</div>
		<nav class="step-navigation" aria-label={m.lessonSteps}>
			<ol>
				{#each lesson.blocks as block, index (block.id)}
					<li>
						<button
							type="button"
							class:current={index === activeIndex}
							class:saved={canWrite && savedIds.has(block.id)}
							aria-current={index === activeIndex ? 'step' : undefined}
							aria-label={`${m.stepLabel} ${index + 1}: ${label(block.type)}${canWrite && savedIds.has(block.id) ? ` · ${m.progressSaved}` : ''}`}
							disabled={busy || (!preview && index > frontier)}
							onclick={() => moveTo(index)}
						>
							{#if canWrite && savedIds.has(block.id)}<Icon name="check" size={17} />{:else}<span>
									{index + 1}
								</span>{/if}
						</button>
					</li>
				{/each}
			</ol>
		</nav>
		{#if lesson.body}<details class="player-overview">
				<summary>{m.lessonOverview}</summary>
				<div class="prose">{lesson.body}</div>
			</details>{/if}
		{#if current}
			<article class="step-content">
				<div class="step-kind">
					<Icon
						name={current.type === 'reading'
							? 'library'
							: current.type === 'choice'
								? 'compass'
								: 'workshop'}
						size={20}
					/>{label(current.type)}
				</div>
				<h2 bind:this={stepHeading} tabindex="-1">
					{current.type === 'reading'
						? current.title || m.readingBlock
						: current.prompt || label(current.type)}
				</h2>
				{#if current.type === 'reading'}
					<div class="prose reading-body">{current.body}</div>
					{#if lesson.age_band === '4-6'}<p class="player-help">
							<Icon name="family" size={17} />{m.readingTogether}
						</p>{/if}
				{:else if current.type === 'reflection'}
					<p class="reflection-hint"><Icon name="leaf" size={22} />{m.reflectionHint}</p>
				{/if}
				<form
					method="POST"
					action={`?/step&hero=${heroId ?? ''}`}
					use:enhance={({ cancel }) => {
						if (!canWrite) {
							cancel();
							return;
						}
						busy = true;
						requestedIndex = activeIndex;
						return async ({ update }) => {
							try {
								await update({ reset: false });
							} finally {
								busy = false;
							}
						};
					}}
				>
					<input type="hidden" name="hero_id" value={heroId ?? ''} />
					<input type="hidden" name="block_id" value={current.id} />
					<input type="hidden" name="content_version" value={lesson.content_version} />
					{#if current.type === 'choice'}
						<fieldset class="choice-fieldset" disabled={busy || currentSaved}>
							<legend>{m.chooseAnswer}</legend>
							{#each current.options as option, index (option.id)}
								<label class="choice-option" class:selected={selectedOption === option.id}>
									<input
										type="radio"
										name="option_id"
										value={option.id}
										bind:group={selectedOption}
										required={!preview}
									/>
									<span class="option-number" aria-hidden="true">
										{String.fromCharCode(65 + index)}
									</span><span>{option.label}</span>
								</label>
							{/each}
						</fieldset>
					{/if}
					<div class="step-feedback" aria-live="polite" aria-atomic="true">
						{#if canWrite && currentSaved}<div class="feedback saved">
								<Icon name="check" size={21} /><span>
									{current.type === 'choice' && feedback?.correct
										? m.correctAnswerFeedback
										: m.stepSaved}
								</span>
							</div>
						{:else if canWrite && feedback && !feedback.correct}<div class="feedback retry">
								<Icon name="compass" size={21} /><span>{m.incorrectAnswer}</span>
							</div>{/if}
					</div>
					{#if canWrite && !currentSaved}<button class="btn" disabled={busy}>
							{busy
								? m.saving
								: current.type === 'reading'
									? m.saveReading
									: current.type === 'choice'
										? m.checkAnswer
										: m.saveReflection}<Icon name="check" size={18} />
						</button>{/if}
				</form>
				<div class="player-navigation actions">
					<button
						type="button"
						class="btn secondary small"
						disabled={busy || activeIndex === 0}
						onclick={() => moveTo(activeIndex - 1)}
					>
						<Icon name="back" size={16} />{m.previousStep}
					</button>
					{#if activeIndex < lesson.blocks.length - 1}<button
							type="button"
							class="btn gold small"
							disabled={busy || (!preview && !currentSaved)}
							onclick={() => moveTo(activeIndex + 1)}
						>
							{preview ? m.previewNext : m.nextStep}<Icon name="arrow" size={16} />
						</button>{/if}
				</div>
			</article>
		{/if}
	{:else}
		<div class="legacy-reading">
			<div class="step-kind"><Icon name="library" size={19} />{m.legacyLesson}</div>
			<div class="prose">{lesson.body || m.noContent}</div>
		</div>
	{/if}
	{#if canWrite}
		<div class="lesson-finish" class:finished={completed}>
			<div class="finish-mark"><Icon name={completed ? 'check' : 'compass'} size={25} /></div>
			<div class="finish-copy">
				<h3>{completed ? m.completed : allSaved ? m.lessonReady : m.inProgress}</h3>
				<p>{completed ? m.completedBody : allSaved ? m.finishHint : m.completeStepsHint}</p>
				<small>
					{justEarned ? m.rewardJustEarned : rewardEarned ? m.earnedBefore : m.lessonReward}
				</small>
			</div>
			<form
				method="POST"
				action={`?/complete&hero=${heroId ?? ''}`}
				use:enhance={() => {
					busy = true;
					return async ({ update }) => {
						try {
							await update({ reset: false });
						} finally {
							busy = false;
						}
					};
				}}
			>
				<input type="hidden" name="hero_id" value={heroId ?? ''} /><input
					type="hidden"
					name="content_version"
					value={lesson.content_version}
				/>
				<button class="btn" disabled={busy || completed || !allSaved}>
					{completed ? m.completed : busy ? m.saving : m.finishLesson}<Icon
						name="check"
						size={17}
					/>
				</button>
			</form>
		</div>
	{/if}
</section>

<style>
	.lesson-player {
		border: 1px solid #d1c7a2;
		background: #fffae9;
		border-radius: 7px 7px 24px 24px;
		box-shadow:
			inset 0 4px 0 #ede0b9,
			0 10px 30px #5f512409;
		overflow: hidden;
	}
	.player-preview-note {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		background: #e6ebdf;
		padding: 18px 25px;
		font-size: 0.75rem;
		line-height: 1.6;
	}
	.player-preview-note :global(svg) {
		flex: none;
		margin-top: 2px;
	}
	.player-topline {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 12px;
		padding: 26px 32px 0;
		font-size: 0.68rem;
		color: #68745b;
	}
	.player-topline > span:last-child {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.step-navigation {
		padding: 18px 32px 23px;
	}
	.step-navigation ol {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.step-navigation button {
		width: 42px;
		height: 42px;
		border: 1px solid #c8c9ae;
		border-radius: 11px;
		background: #f0ecd9;
		color: #68745b;
		display: grid;
		place-items: center;
		font-size: 0.79rem;
		font-weight: 650;
	}
	.step-navigation button.current {
		background: #234e3e;
		color: #fff2c9;
		border-color: #234e3e;
		box-shadow: 0 0 0 3px #d8caa0;
	}
	.step-navigation button.saved:not(.current) {
		background: #dce5cd;
		border-color: #aaba91;
		color: #3d5f3f;
	}
	.player-overview {
		margin: 0 32px 23px;
		border-block: 1px solid #ded7b9;
		padding: 15px 0;
		font-size: 0.8rem;
	}
	.player-overview summary {
		cursor: pointer;
		font-weight: 650;
	}
	.player-overview .prose {
		margin-top: 17px;
	}
	.step-content {
		padding: 6px 32px 29px;
	}
	.step-kind {
		display: flex;
		align-items: center;
		gap: 8px;
		color: #7c865d;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		font-size: 0.61rem;
		font-weight: 650;
		margin-bottom: 17px;
	}
	.step-content h2 {
		font-size: clamp(1.7rem, 3vw, 2.3rem);
		line-height: 1.25;
		margin-bottom: 24px;
		overflow-wrap: anywhere;
	}
	.step-content h2:focus-visible {
		outline: 2px solid #b7832d;
		outline-offset: 6px;
	}
	.reading-body {
		margin-bottom: 25px;
		font-size: 1rem;
	}
	.player-help {
		display: flex;
		gap: 8px;
		align-items: center;
		color: #6b7a60;
		font-size: 0.75rem;
		margin-bottom: 20px;
	}
	.reflection-hint {
		display: flex;
		gap: 13px;
		color: #6c775b;
		background: #f1efd9;
		padding: 20px;
		border-radius: 12px;
		margin-bottom: 24px;
		font-size: 0.85rem;
	}
	.reflection-hint :global(svg) {
		flex: none;
		margin-top: 2px;
	}
	.choice-fieldset {
		border: 0;
		padding: 0;
		margin: 0;
		min-width: 0;
	}
	.choice-fieldset legend {
		font-size: 0.78rem;
		color: #6a775a;
		margin-bottom: 15px;
	}
	.choice-option {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 17px 15px;
		border: 1px solid #d5d2b8;
		border-radius: 11px;
		background: #fffdf3;
		margin-bottom: 11px;
		cursor: pointer;
		font-size: 0.91rem;
		line-height: 1.5;
	}
	.choice-option.selected {
		border-color: #5f7f54;
		background: #eaf0db;
		box-shadow: 0 0 0 1px #5f7f54;
	}
	.choice-option input {
		flex: none;
		width: 17px;
		height: 17px;
		accent-color: var(--forest);
		margin: 0;
	}
	.choice-option > span:last-child {
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.option-number {
		flex: none;
		font-size: 0.66rem;
		color: #7c8865;
		font-weight: 650;
	}
	.choice-fieldset:disabled .choice-option {
		cursor: default;
	}
	.feedback {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		padding: 15px 17px;
		border-radius: 10px;
		font-size: 0.82rem;
		line-height: 1.6;
		margin: 17px 0;
	}
	.feedback :global(svg) {
		flex: none;
		margin-top: 2px;
	}
	.feedback.saved {
		background: #e2ebd1;
		color: #35573c;
	}
	.feedback.retry {
		background: #f2e7c5;
		color: #735b30;
	}
	.player-navigation {
		justify-content: space-between;
		margin-top: 27px;
		padding-top: 23px;
		border-top: 1px solid #dfd8b9;
	}
	.legacy-reading {
		padding: 35px;
	}
	.lesson-finish {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 16px;
		padding: 26px 32px;
		background: #eee8d1;
		border-top: 1px solid #d8d1b2;
	}
	.lesson-finish.finished {
		background: #e2e9d3;
	}
	.finish-mark {
		flex: none;
		width: 49px;
		height: 54px;
		display: grid;
		place-items: center;
		background: #d7dbc0;
		color: #5c7050;
		border-radius: 15px 15px 22px 22px;
	}
	.finish-copy {
		flex: 1;
		min-width: 160px;
	}
	.finish-copy h3 {
		font-family: var(--font-display);
		font-size: 1.4rem;
		font-weight: 400;
		margin-bottom: 7px;
	}
	.finish-copy p {
		font-size: 0.76rem;
		color: #667257;
	}
	.finish-copy small {
		display: block;
		font-size: 0.68rem;
		margin-top: 8px;
		color: #657357;
	}
	.lesson-finish form {
		width: 100%;
		margin-top: 5px;
	}
	@media (max-width: 600px) {
		.player-topline {
			padding: 23px 21px 0;
		}
		.step-navigation {
			padding: 16px 21px 20px;
		}
		.step-navigation ol {
			gap: 8px;
		}
		.step-navigation button {
			width: 39px;
			height: 39px;
		}
		.step-content {
			padding: 5px 21px 24px;
		}
		.player-overview {
			margin-inline: 21px;
		}
		.legacy-reading {
			padding: 26px 21px;
		}
		.lesson-finish {
			padding: 23px 21px;
		}
		.choice-option {
			padding: 16px 12px;
			gap: 10px;
		}
		.player-navigation {
			align-items: stretch;
		}
		.player-navigation .btn {
			flex: 1;
		}
		.lesson-finish .btn {
			width: 100%;
		}
	}
</style>
