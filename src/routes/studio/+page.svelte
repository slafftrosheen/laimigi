<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { getMessages, localeNames, locationLabel } from '#lib/i18n/index';
	import Icon from '#lib/components/Icon.svelte';
	import Notice from '#lib/components/Notice.svelte';
	import LessonForm from '#lib/components/LessonForm.svelte';
	import type { PageProps } from './$types';
	let { data, form }: PageProps = $props();
	let m = $derived(getMessages(data.locale));
	let confirmId = $state('');
</script>

<svelte:head><title>{m.studio} · Laimīgie bērni</title></svelte:head>
<div class="container">
	<div class="page-heading split">
		<div>
			<div class="eyebrow"><Icon name="workshop" size={16} />{m.studio}</div>
			<h1>{m.studioTitle}</h1>
			<p>{m.studioIntro}</p>
		</div>
		<a class="btn secondary" href={resolve('/studio/assistant')}>
			<Icon name="spark" size={18} />{m.assistant}
		</a>
	</div>
	<Notice {form} locale={data.locale} />
	<div class="studio-layout content-section">
		<section>
			<div class="section-heading">
				<h2>{m.materials}</h2>
				<span class="badge">{data.lessons.length}</span>
			</div>
			{#if !data.lessons.length}<div class="empty-state">
					<div class="icon-disc"><Icon name="workshop" size={28} /></div>
					<h3>{m.noDrafts}</h3>
					<p>{m.noDraftsBody}</p>
					<a class="text-link" href="#new-material">
						{m.newMaterial}<Icon name="plus" size={16} />
					</a>
				</div>{:else}<div class="stack">
					{#each data.lessons as lesson (lesson.id)}<article class="studio-card">
							<div class="studio-card-heading">
								<span class="badge" class:draft={lesson.status === 'draft'}>
									{lesson.status === 'published' ? m.published : m.draft}
								</span><span class="muted small">
									{localeNames[lesson.locale]} · {lesson.age_band}
								</span>
							</div>
							<a
								class="material-title"
								href={resolve('/studio/[lessonId]', { lessonId: lesson.id })}
							>
								<h3>{lesson.title}</h3>
							</a>
							<p>{lesson.description}</p>
							<div class="studio-card-footer">
								<span class="place-label">
									<Icon name={lesson.location} size={16} />{locationLabel(
										lesson.location,
										data.locale
									)}
								</span><a
									class="text-link"
									href={resolve('/studio/[lessonId]', { lessonId: lesson.id })}
								>
									{m.editMaterial}<Icon name="arrow" size={16} />
								</a>
							</div>
							<div class="card-actions">
								<form method="POST" action="?/duplicate" use:enhance>
									<input type="hidden" name="lesson_id" value={lesson.id} /><button
										class="btn secondary small"
									>
										<Icon name="copy" size={15} />{m.duplicateMaterial}
									</button>
								</form>
								{#if lesson.status === 'draft'}<form method="POST" action="?/publish" use:enhance>
										<input type="hidden" name="lesson_id" value={lesson.id} /><button
											class="btn small"
										>
											{m.publish}<Icon name="check" size={15} />
										</button>
									</form>{:else}<a
										class="btn secondary small"
										href={resolve('/learn/[lessonId]', { lessonId: lesson.id })}
									>
										{m.openMaterial}
									</a>{/if}
								<details class="delete-detail">
									<summary>{m.deleteMaterial}</summary>
									<form method="POST" action="?/delete" use:enhance>
										<input type="hidden" name="lesson_id" value={lesson.id} /><label
											class="check-field"
										>
											<input
												type="checkbox"
												required
												checked={confirmId === lesson.id}
												onchange={(event) =>
													(confirmId = event.currentTarget.checked ? lesson.id : '')}
											/><span>{m.confirmRemove}</span>
										</label><button class="btn danger small" disabled={confirmId !== lesson.id}>
											{m.remove}
										</button>
									</form>
								</details>
							</div>
						</article>{/each}
				</div>{/if}
			<p class="source-note spacer-top">{m.draftNote}</p>
		</section>
		<aside class="panel" id="new-material">
			<div class="eyebrow"><Icon name="plus" size={16} />{m.draft}</div>
			<h2 style="margin:13px 0 24px">{m.newMaterial}</h2>
			<LessonForm
				locale={data.locale}
				action="?/create"
				values={form && 'values' in form ? form.values : undefined}
			/>
		</aside>
	</div>
</div>

<style>
	.studio-layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 430px;
		gap: 32px;
	}
	.studio-layout > aside {
		height: fit-content;
	}
	.studio-card {
		background: var(--paper);
		border: 1px solid var(--line);
		border-radius: 14px;
		padding: 24px;
	}
	.studio-card-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 17px;
	}
	.studio-card-heading .small {
		font-size: 0.67rem;
	}
	.material-title h3 {
		font-family: var(--font-display);
		font-size: 1.6rem;
		font-weight: 400;
		margin-bottom: 11px;
	}
	.material-title:hover {
		text-decoration: underline;
		text-underline-offset: 4px;
	}
	.studio-card > p {
		font-size: 0.79rem;
		color: var(--muted);
		line-height: 1.7;
	}
	.studio-card-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
		margin-top: 22px;
		padding-top: 18px;
		border-top: 1px solid var(--line);
	}
	.place-label {
		display: flex;
		align-items: center;
		gap: 7px;
		color: var(--muted);
		font-size: 0.68rem;
	}
	.studio-card-footer .text-link {
		font-size: 0.72rem;
	}
	.card-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: 18px;
		margin-top: 18px;
	}
	.delete-detail {
		margin-left: auto;
		font-size: 0.67rem;
		color: var(--muted);
	}
	.delete-detail summary {
		padding: 9px 0;
		cursor: pointer;
	}
	.delete-detail form {
		padding-top: 10px;
	}
	.delete-detail .check-field {
		font-size: 0.68rem;
	}
	#new-material {
		scroll-margin-top: 25px;
	}
	@media (max-width: 1000px) {
		.studio-layout {
			grid-template-columns: 1fr;
		}
		.studio-layout > aside {
			max-width: 700px;
			width: 100%;
		}
	}
	@media (max-width: 600px) {
		.studio-card {
			padding: 21px;
		}
		.studio-card-footer {
			align-items: flex-start;
			flex-direction: column;
			gap: 13px;
		}
	}
</style>
