<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { getMessages } from '#lib/i18n/index';
	import { APP_ROLES, type AppRole } from '#lib/types';
	import Icon from '#lib/components/Icon.svelte';
	import Notice from '#lib/components/Notice.svelte';
	import type { PageProps } from './$types';
	let { data, form }: PageProps = $props();
	let m = $derived(getMessages(data.locale));
	let busy = $state('');
	function roleName(role: AppRole) {
		return role === 'root_admin'
			? m.rootAdministrator
			: role === 'admin'
				? m.administrator
				: role === 'teacher'
					? m.teacher
					: m.parent;
	}
</script>

<svelte:head><title>{m.manageUsers} · Laimīgie bērni</title></svelte:head>
<div class="container">
	<div class="page-heading">
		<a class="text-link" href={resolve('/admin')}><Icon name="back" size={16} />{m.admin}</a>
		<h1>{m.usersTitle}</h1>
		<p>{m.usersIntro}</p>
	</div>
	<section class="content-section">
		<Notice {form} locale={data.locale} />{#if data.users.length}<div class="table-wrap">
				<table>
					<thead><tr><th>{m.user}</th><th>{m.role}</th><th>{m.changeRole}</th></tr></thead><tbody>
						{#each data.users as user (user.id)}<tr>
								<td>
									<strong class="word-break">{user.email}</strong><br /><small class="mono">
										{user.id}
									</small>
								</td><td><span class="badge">{roleName(user.role)}</span></td><td>
									{#if user.id === data.user?.id}<small>{m.ownRoleNote}</small>{:else}<form
											method="POST"
											class="inline-form"
											use:enhance={() => {
												busy = user.id;
												return async ({ update }) => {
													await update();
													busy = '';
												};
											}}
										>
											<input type="hidden" name="user_id" value={user.id} /><select
												class="control"
												name="role"
												value={user.role}
												aria-label={`${m.role}: ${user.email}`}
												disabled={busy !== ''}
											>
												{#each APP_ROLES as role (role)}<option value={role}>
														{roleName(role)}
													</option>{/each}
											</select><button class="btn small" disabled={busy !== ''}>
												{busy === user.id ? m.saving : m.save}
											</button>
										</form>{/if}
								</td>
							</tr>{/each}
					</tbody>
				</table>
			</div>
			<nav class="pagination" aria-label={m.page}>
				{#if data.page > 1}<a
						class="btn secondary small"
						href={resolve(`/admin/users?page=${data.page - 1}`)}
					>
						<Icon name="back" size={15} />{m.previousPage}
					</a>{/if}<span class="muted small">{m.page} {data.page}</span>{#if data.hasNext}<a
						class="btn secondary small"
						href={resolve(`/admin/users?page=${data.page + 1}`)}
					>
						{m.nextPage}<Icon name="arrow" size={15} />
					</a>{/if}
			</nav>{:else}<div class="empty-state">
				<div class="icon-disc"><Icon name="family" size={27} /></div>
				<h3>{m.noUsers}</h3>
			</div>{/if}
	</section>
</div>

<style>
	.pagination {
		display: flex;
		gap: 20px;
		justify-content: center;
		align-items: center;
		margin-top: 23px;
	}
	td strong {
		font-size: 0.79rem;
		font-weight: 600;
	}
	td .mono {
		font-size: 0.61rem;
	}
	td:first-child {
		max-width: 330px;
	}
	td:last-child {
		min-width: 260px;
	}
	.inline-form .control {
		font-size: 0.76rem;
		min-height: 39px;
		padding: 9px;
	}
	.inline-form .btn {
		white-space: nowrap;
		font-size: 0.67rem;
	}
	@media (max-width: 700px) {
		td:first-child {
			min-width: 240px;
		}
	}
</style>
