<script lang="ts">
	import { enhance } from '$app/forms';
	import { onMount, tick, untrack } from 'svelte';
	import {
		getMessages,
		locales,
		localeNames,
		locationKeys,
		leagueLabel,
		type Locale
	} from '#lib/i18n/index';
	import type { AgeBand, AuthorLessonBlock, Lesson, LessonBlock, WorldLocation } from '#lib/types';
	import type { LessonEditorValues } from '#lib/server/lesson-editor';
	import Icon from './Icon.svelte';
	import LessonPlayer from './LessonPlayer.svelte';
	let {
		locale,
		lesson,
		authorBlocks = [],
		values,
		action = ''
	}: {
		locale: Locale;
		lesson?: Lesson;
		authorBlocks?: AuthorLessonBlock[];
		values?: LessonEditorValues;
		action?: string;
	} = $props();
	let m = $derived(getMessages(locale));
	let busy = $state(false);
	let preview = $state(false);
	let announcement = $state('');
	let interactive = $state(false);
	onMount(() => {
		interactive = true;
	});
	let updatedAt = $state(untrack(() => values?.updated_at ?? lesson?.updated_at ?? ''));
	let fields = $state(
		untrack(() => ({
			title: values?.title ?? lesson?.title ?? '',
			description: values?.description ?? lesson?.description ?? '',
			body: values?.body ?? lesson?.body ?? '',
			locale: (values?.locale ?? lesson?.locale ?? locale) as Locale,
			age_band: (values?.age_band ?? lesson?.age_band ?? '7-9') as AgeBand,
			location: (values?.location ?? lesson?.location ?? 'school') as WorldLocation,
			status: (values?.status ?? lesson?.status ?? 'draft') as 'draft' | 'published'
		}))
	);
	let blocks = $state<AuthorLessonBlock[]>(
		untrack(() =>
			(values?.blocks ?? authorBlocks).map((block) =>
				block.type === 'choice'
					? { ...block, options: block.options.map((option) => ({ ...option })) }
					: { ...block }
			)
		)
	);
	let editor: HTMLDivElement | undefined = $state();
	let publicBlocks = $derived<LessonBlock[]>(
		blocks.map((block) =>
			block.type === 'choice'
				? {
						id: block.id,
						type: 'choice',
						prompt: block.prompt,
						options: block.options.map((option) => ({ ...option }))
					}
				: { ...block }
		)
	);
	let previewLesson = $derived<Lesson>({
		id: lesson?.id ?? 'e2db3e7d-5f48-45fb-8487-3dfaa02b3296',
		author_id: lesson?.author_id ?? '',
		...fields,
		blocks: publicBlocks,
		content_version: lesson?.content_version ?? 1,
		created_at: lesson?.created_at ?? '',
		updated_at: lesson?.updated_at ?? ''
	});
	async function addBlock(type: AuthorLessonBlock['type']) {
		if (blocks.length >= 12) return;
		const id = crypto.randomUUID();
		const block: AuthorLessonBlock =
			type === 'reading'
				? { id, type, title: '', body: '' }
				: type === 'reflection'
					? { id, type, prompt: '' }
					: {
							id,
							type,
							prompt: '',
							options: [
								{ id: crypto.randomUUID(), label: '' },
								{ id: crypto.randomUUID(), label: '' }
							],
							correct_option_id: ''
						};
		blocks = [...blocks, block];
		announcement = m.newStepFocus;
		await tick();
		editor
			?.querySelector<HTMLInputElement | HTMLTextAreaElement>(
				`[data-block-id="${id}"] .field input, [data-block-id="${id}"] .field textarea`
			)
			?.focus();
	}
	function reorder(index: number, direction: -1 | 1) {
		const next = index + direction;
		if (next < 0 || next >= blocks.length) return;
		const ordered = [...blocks];
		[ordered[index], ordered[next]] = [ordered[next], ordered[index]];
		blocks = ordered;
	}
	function addOption(block: AuthorLessonBlock) {
		if (block.type === 'choice' && block.options.length < 4)
			block.options = [...block.options, { id: crypto.randomUUID(), label: '' }];
	}
	function removeOption(block: AuthorLessonBlock, optionId: string) {
		if (block.type !== 'choice' || block.options.length <= 2) return;
		block.options = block.options.filter((option) => option.id !== optionId);
		if (block.correct_option_id === optionId) block.correct_option_id = '';
	}
	async function removeBlock(index: number) {
		blocks = blocks.filter((_, position) => position !== index);
		await tick();
		const nextId = blocks[Math.min(index, blocks.length - 1)]?.id;
		if (nextId)
			editor
				?.querySelector<HTMLInputElement | HTMLTextAreaElement>(
					`[data-block-id="${nextId}"] .field input, [data-block-id="${nextId}"] .field textarea`
				)
				?.focus();
		else editor?.querySelector<HTMLButtonElement>('.add-blocks button')?.focus();
	}
</script>

<div class="lesson-editor" bind:this={editor}>
	<form
		method="POST"
		{action}
		use:enhance={() => {
			busy = true;
			return async ({ update, result }) => {
				try {
					await update({ reset: false });
					if (result.type === 'success') {
						await tick();
						updatedAt = lesson?.updated_at ?? updatedAt;
					}
				} finally {
					busy = false;
				}
			};
		}}
	>
		<input type="hidden" name="blocks" value={JSON.stringify(blocks)} />
		{#if lesson}<input type="hidden" name="updated_at" value={updatedAt} />{/if}
		<fieldset class="editor-fields" disabled={busy}>
			<legend class="sr-only">{m.materialSettings}</legend>
			<label class="field">
				<span>{m.title}</span><input
					name="title"
					minlength="3"
					maxlength="120"
					required
					bind:value={fields.title}
				/>
			</label>
			<label class="field">
				<span>{m.description}</span><textarea
					name="description"
					maxlength="400"
					rows="2"
					bind:value={fields.description}></textarea>
			</label>
			<div class="field-row">
				<label class="field">
					<span>{m.contentLanguage}</span><select name="locale" bind:value={fields.locale}>
						{#each locales as language (language)}<option value={language}>
								{localeNames[language]}
							</option>{/each}
					</select>
				</label>
				<label class="field">
					<span>{m.ageBand}</span><select name="age_band" bind:value={fields.age_band}>
						{#each ['4-6', '7-9', '10-12'] as age (age)}<option value={age}>
								{leagueLabel(age, locale)}
							</option>{/each}
					</select>
				</label>
			</div>
			<label class="field">
				<span>{m.location}</span><select name="location" bind:value={fields.location}>
					{#each locationKeys as location (location)}<option value={location}>
							{m[location]}
						</option>{/each}
				</select>
			</label>
			<label class="field">
				<span>{m.lessonOverview}</span><textarea
					name="body"
					minlength={blocks.length ? undefined : 10}
					maxlength="20000"
					rows="5"
					required={!blocks.length}
					bind:value={fields.body}></textarea><small>{m.overviewHint}</small>
			</label>
			<div class="editor-section-heading">
				<div>
					<h3>{m.lessonSteps}</h3>
					<p>{m.stepsIntro}</p>
				</div>
				<span class="badge">{blocks.length} / 12</span>
			</div>
			<p class="sr-only" aria-live="polite">{announcement}</p>
			{#if !blocks.length}<div class="empty-blocks">
					<Icon name="library" size={22} />
					<p>{m.emptySteps}</p>
				</div>{/if}
			<noscript>
				<div class="notice"><Icon name="info" size={19} /><span>{m.editorNeedsScript}</span></div>
			</noscript>
			<fieldset class="interactive-fields" disabled={!interactive}>
				<legend class="sr-only">{m.lessonSteps}</legend>
				<div class="block-list">
					{#each blocks as block, index (block.id)}
						<section
							class="editor-block"
							data-block-id={block.id}
							aria-label={`${m.stepLabel} ${index + 1}`}
						>
							<div class="editor-block-toolbar">
								<div>
									<span class="block-index">{index + 1}</span>
									<h4>
										{block.type === 'reading'
											? m.readingBlock
											: block.type === 'choice'
												? m.choiceBlock
												: m.reflectionBlock}
									</h4>
								</div>
								<div class="block-tools">
									<button
										type="button"
										aria-label={`${m.moveUp}: ${m.stepLabel} ${index + 1}`}
										disabled={index === 0}
										onclick={() => reorder(index, -1)}
									>
										<Icon name="up" size={17} />
									</button>
									<button
										type="button"
										aria-label={`${m.moveDown}: ${m.stepLabel} ${index + 1}`}
										disabled={index === blocks.length - 1}
										onclick={() => reorder(index, 1)}
									>
										<Icon name="down" size={17} />
									</button>
									<button
										type="button"
										aria-label={`${m.removeStep}: ${index + 1}`}
										onclick={() => removeBlock(index)}
									>
										<Icon name="trash" size={17} />
									</button>
								</div>
							</div>
							{#if block.type === 'reading'}
								<label class="field">
									<span>{m.stepTitle}</span><input
										required
										maxlength="160"
										bind:value={block.title}
									/>
								</label>
								<label class="field">
									<span>{m.readingText}</span><textarea
										required
										maxlength="6000"
										rows="6"
										bind:value={block.body}></textarea>
								</label>
							{:else if block.type === 'reflection'}
								<label class="field">
									<span>{m.reflectionPrompt}</span><textarea
										required
										maxlength="1200"
										rows="4"
										bind:value={block.prompt}></textarea>
								</label>
							{:else}
								<label class="field">
									<span>{m.questionPrompt}</span><textarea
										required
										maxlength="1200"
										rows="3"
										bind:value={block.prompt}></textarea>
								</label>
								<fieldset class="options-editor">
									<legend>{m.answerOptions}</legend>
									{#each block.options as option, optionIndex (option.id)}
										<div class="option-editor-row">
											<span class="option-letter" aria-hidden="true">
												{String.fromCharCode(65 + optionIndex)}
											</span><label class="field">
												<span class="sr-only">{m.answerOption} {optionIndex + 1}</span><input
													required
													maxlength="400"
													bind:value={option.label}
												/>
											</label><button
												type="button"
												class="icon-button"
												disabled={block.options.length <= 2}
												aria-label={`${m.removeOption} ${optionIndex + 1}`}
												onclick={() => removeOption(block, option.id)}
											>
												<Icon name="close" size={17} />
											</button>
										</div>
									{/each}
									<button
										type="button"
										class="text-link add-option"
										disabled={block.options.length >= 4}
										onclick={() => addOption(block)}
									>
										<Icon name="plus" size={15} />{m.addOption}
									</button>
								</fieldset>
								<label class="field correct-field">
									<span>{m.correctAnswer}</span><select
										bind:value={block.correct_option_id}
										required
									>
										<option value="" disabled>
											{m.correctAnswer}
										</option>{#each block.options as option, optionIndex (option.id)}<option
												value={option.id}
											>
												{String.fromCharCode(65 + optionIndex)} · {option.label ||
													`${m.answerOption} ${optionIndex + 1}`}
											</option>{/each}
									</select><small>{m.correctAnswerHint}</small>
								</label>
							{/if}
						</section>
					{/each}
				</div>
				<div class="add-blocks actions">
					<button
						type="button"
						class="btn secondary small"
						disabled={blocks.length >= 12}
						onclick={() => addBlock('reading')}
					>
						<Icon name="library" size={17} />{m.addReading}
					</button>
					<button
						type="button"
						class="btn secondary small"
						disabled={blocks.length >= 12}
						onclick={() => addBlock('choice')}
					>
						<Icon name="compass" size={17} />{m.addChoice}
					</button>
					<button
						type="button"
						class="btn secondary small"
						disabled={blocks.length >= 12}
						onclick={() => addBlock('reflection')}
					>
						<Icon name="workshop" size={17} />{m.addReflection}
					</button>
				</div>
				<p class="source-note">{m.maxStepsHint}</p>
			</fieldset>
			{#if lesson}<label class="field status-field">
					<span id="lesson-status-label">{m.status}</span><select
						name="status"
						bind:value={fields.status}
						aria-labelledby="lesson-status-label"
					>
						<option value="draft">{m.draft}</option><option value="published">{m.published}</option>
					</select><small>{m.contentRevisionHint}</small>
				</label>{:else}<input type="hidden" name="status" value="draft" />{/if}
			<div class="editor-footer actions">
				<button class="btn" disabled={busy}>
					{busy ? m.saving : lesson ? m.save : m.createDraft}<Icon
						name={lesson ? 'check' : 'plus'}
						size={18}
					/>
				</button><button
					type="button"
					class="btn secondary"
					disabled={!interactive}
					aria-expanded={preview}
					onclick={() => (preview = !preview)}
				>
					<Icon name="eye" size={17} />{preview ? m.closePreview : m.previewLesson}
				</button>
			</div>
		</fieldset>
	</form>
	{#if preview}<section class="editor-preview" aria-label={m.previewLabel}>
			<div class="section-heading">
				<div>
					<div class="eyebrow">{m.previewLabel}</div>
					<h2>{fields.title || m.newMaterial}</h2>
				</div>
				<span class="badge">{localeNames[fields.locale]}</span>
			</div>
			<p class="source-note">{m.unsavedPreview}</p>
			<p class="preview-description">{fields.description}</p>
			<LessonPlayer lesson={previewLesson} {locale} preview />
		</section>{/if}
</div>

<style>
	.editor-fields,
	.interactive-fields {
		border: 0;
		padding: 0;
		margin: 0;
		min-width: 0;
	}
	.editor-section-heading {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 15px;
		margin: 31px 0 20px;
		border-top: 1px solid var(--line);
		padding-top: 28px;
	}
	.editor-section-heading h3 {
		font-family: var(--font-display);
		font-size: 1.7rem;
		font-weight: 400;
	}
	.editor-section-heading p {
		font-size: 0.76rem;
		color: var(--muted);
		margin-top: 9px;
	}
	.editor-section-heading .badge {
		flex: none;
	}
	.empty-blocks {
		display: flex;
		gap: 14px;
		border: 1px dashed #c4cdb6;
		border-radius: 12px;
		padding: 21px;
		background: #f0f2e7;
		margin-bottom: 19px;
		color: var(--muted);
		font-size: 0.78rem;
	}
	.empty-blocks :global(svg) {
		flex: none;
		margin-top: 3px;
	}
	.block-list {
		display: grid;
		gap: 18px;
	}
	.editor-block {
		min-width: 0;
		padding: 22px;
		background: #f4f5ed;
		border: 1px solid #d8dfca;
		border-radius: 14px;
	}
	.editor-block-toolbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 10px;
		margin-bottom: 22px;
	}
	.editor-block-toolbar > div:first-child {
		display: flex;
		align-items: center;
		gap: 11px;
		min-width: 0;
	}
	.editor-block-toolbar h4 {
		margin: 0;
		font-size: 0.79rem;
		font-weight: 650;
	}
	.block-index {
		display: grid;
		place-items: center;
		width: 29px;
		height: 31px;
		border: 1px solid #b6c5a2;
		border-radius: 8px;
		color: #426448;
		background: #e4e9da;
		flex: none;
		font-size: 0.75rem;
	}
	.block-tools {
		display: flex;
		flex: none;
		gap: 3px;
	}
	.block-tools button,
	.icon-button {
		background: transparent;
		border: 1px solid transparent;
		color: var(--muted);
		display: grid;
		place-items: center;
		padding: 7px;
		border-radius: 6px;
	}
	.block-tools button:hover:not(:disabled),
	.icon-button:hover:not(:disabled) {
		background: #e6eadb;
		border-color: #cbd3bc;
	}
	.editor-block > .field:last-child {
		margin-bottom: 0;
	}
	.options-editor {
		border: 0;
		padding: 0;
		margin: 0 0 20px;
		min-width: 0;
	}
	.options-editor legend {
		font-size: 0.74rem;
		font-weight: 650;
		margin-bottom: 11px;
	}
	.option-editor-row {
		display: flex;
		align-items: center;
		gap: 9px;
		margin-bottom: 11px;
	}
	.option-editor-row .field {
		flex: 1;
		min-width: 0;
		margin: 0;
	}
	.option-letter {
		flex: none;
		font-size: 0.66rem;
		font-weight: 650;
		color: var(--muted);
		width: 15px;
	}
	.add-option {
		padding: 5px 0;
		background: transparent;
		border: 0;
		font-size: 0.73rem;
	}
	.correct-field {
		margin: 0;
	}
	.add-blocks {
		margin-top: 20px;
		gap: 10px;
	}
	.add-blocks .btn {
		font-size: 0.71rem;
	}
	.lesson-editor .source-note {
		margin-top: 12px;
	}
	.status-field {
		margin-top: 26px;
	}
	.editor-footer {
		padding-top: 24px;
		margin-top: 25px;
		border-top: 1px solid var(--line);
	}
	.editor-preview {
		margin-top: 40px;
		padding-top: 31px;
		border-top: 1px solid var(--line);
	}
	.editor-preview h2 {
		margin-top: 10px;
		font-size: 2rem;
		overflow-wrap: anywhere;
	}
	.preview-description {
		margin: 20px 0;
		color: var(--muted);
		font-size: 0.86rem;
		overflow-wrap: anywhere;
	}
	@media (max-width: 600px) {
		.editor-block {
			padding: 16px;
		}
		.editor-block-toolbar {
			flex-wrap: wrap;
		}
		.block-tools {
			margin-left: auto;
		}
		.editor-footer .btn {
			width: 100%;
		}
		.add-blocks {
			flex-direction: column;
			align-items: stretch;
		}
	}
</style>
