import { expect, test, type BrowserContext, type Page } from '@playwright/test';

const fixture = 'http://127.0.0.1:54329';
const origin = 'http://127.0.0.1:4173';
const password = 'LocalOnlyPassword123!';

async function capture(page: Page, name: string) {
	const path = test.info().outputPath(`ui/${name}.png`);
	await page.screenshot({ path, fullPage: true });
	await test.info().attach(name, { path, contentType: 'image/png' });
}

async function english(context: BrowserContext) {
	await context.addCookies([
		{ name: 'locale', value: 'en', url: origin, httpOnly: true, sameSite: 'Lax' }
	]);
}

async function login(page: Page, role: 'parent' | 'teacher' | 'root_admin') {
	await page.goto('/auth/login');
	await page.getByLabel('Email', { exact: true }).fill(`${role}@example.test`);
	await page.getByLabel('Password', { exact: true }).fill(password);
	await page.getByRole('button', { name: 'Sign in', exact: true }).click();
	await expect(page).toHaveURL(/\/family$/);
	await expect(page.getByRole('heading', { name: 'Every hero starts here.' })).toBeVisible();
}

test.beforeEach(async ({ request, context }) => {
	const response = await request.post(`${fixture}/__test/reset`);
	expect(response.ok()).toBeTruthy();
	await english(context);
});

test('family creates a hero, enters the world, completes a published lesson and keeps progress', async ({
	page,
	request
}) => {
	await login(page, 'parent');
	await page.getByLabel('Hero nickname').fill('Comet');
	await page.getByLabel('Age league').selectOption('7-9');
	await page.getByLabel('Preferred learning language').selectOption('en');
	await page.locator('input[name="avatar"][value="compass"]').check();
	await page.getByRole('button', { name: 'Create a hero', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Comet', exact: true })).toBeVisible();
	await page.getByRole('link', { name: 'Enter the world' }).click();
	await expect(page).toHaveURL(/\/play\/[a-f0-9-]+$/);
	await capture(page, 'world-desktop');
	await page.setViewportSize({ width: 390, height: 844 });
	await capture(page, 'world-mobile');
	await page.getByRole('link', { name: /An observatory discovery/ }).click();
	await expect(
		page.getByRole('heading', { name: 'An observatory discovery', exact: true })
	).toBeVisible();
	await expect(page.getByLabel('Who is learning?')).toHaveValue(/^[a-f0-9-]+$/);
	await page.getByRole('button', { name: 'Mark as completed', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Completed', exact: true })).toBeDisabled();
	await page.reload();
	await expect(page.getByRole('button', { name: 'Completed', exact: true })).toBeDisabled();
	await capture(page, 'completed-lesson-mobile');
	const state = await (await request.get(`${fixture}/__test/state`)).json();
	expect(state.children).toHaveLength(1);
	expect(state.progress).toHaveLength(1);
	expect(state.progress[0].child_profile_id).toBe(state.children[0].id);
	expect(state.progress[0].status).toBe('completed');
});

test('teacher creates a draft, edits it and publishes the reviewed material', async ({
	page,
	request
}) => {
	await login(page, 'teacher');
	await page.goto('/studio');
	await page.getByLabel('Title', { exact: true }).fill('Shapes around us');
	await page
		.getByLabel('Short description', { exact: true })
		.fill('An observation activity for the workshop.');
	await page
		.getByLabel('Learning material', { exact: false })
		.fill('Find three shapes around the room. Compare them with a grown-up.');
	await page.getByLabel('Content language').selectOption('en');
	await page.getByLabel('Age league').selectOption('7-9');
	await page.getByLabel('Learning place').selectOption('workshop');
	await page.getByRole('button', { name: 'Create draft', exact: true }).click();
	const card = page
		.locator('article')
		.filter({ has: page.getByRole('heading', { name: 'Shapes around us', exact: true }) });
	await expect(card.getByText('Draft', { exact: true })).toBeVisible();
	let state = await (await request.get(`${fixture}/__test/state`)).json();
	expect(
		state.lessons.find((item: { title: string }) => item.title === 'Shapes around us').status
	).toBe('draft');
	await page.getByRole('link', { name: 'Shapes around us', exact: true }).click();
	await page.getByLabel('Title', { exact: true }).fill('Shapes: look and compare');
	await page.getByLabel('Status').selectOption('published');
	await page.getByRole('button', { name: 'Save changes', exact: true }).click();
	await expect(page.getByText('Material updated.', { exact: true })).toBeVisible();
	await page.reload();
	await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Shapes: look and compare');
	await expect(page.getByLabel('Status')).toHaveValue('published');
	await capture(page, 'teacher-published-material');
	state = await (await request.get(`${fixture}/__test/state`)).json();
	expect(
		state.lessons.find((item: { title: string }) => item.title === 'Shapes: look and compare')
			.status
	).toBe('published');
	await page.goto('/learn');
	await expect(page.getByRole('link', { name: /Shapes: look and compare/ })).toBeVisible();
});

test('root saves an encrypted provider key without echoing it and can remove it', async ({
	page,
	request
}) => {
	await login(page, 'root_admin');
	await page.goto('/admin/ai');
	const provider = page.getByRole('region', { name: 'OpenRouter', exact: true });
	const dummyKey = 'local-only-provider-key-do-not-use-1234';
	await provider.getByLabel('API key').fill(dummyKey);
	await provider.getByLabel('Model ID').fill('openai/test-model');
	await provider.getByLabel('Enable this provider').check();
	const savedResponse = page.waitForResponse(
		(response) =>
			response.url().includes('/admin/ai?/save') && response.request().method() === 'POST'
	);
	await provider.getByRole('button', { name: 'Save changes', exact: true }).click();
	expect(await (await savedResponse).text()).not.toContain(dummyKey);
	await expect(page.getByText('Provider settings saved.', { exact: true })).toBeVisible();
	await expect(provider.getByText('A key is saved', { exact: true })).toBeVisible();
	await expect(provider.getByLabel('API key')).toHaveValue('');
	await page.reload();
	expect(await page.content()).not.toContain(dummyKey);
	await expect(provider.getByText('•••• 1234')).toBeVisible();
	await capture(page, 'root-provider-settings');
	let state = await (await request.get(`${fixture}/__test/state`)).json();
	expect(state.encryptedProviders).toEqual(['openrouter']);
	expect(JSON.stringify(state)).not.toContain(dummyKey);
	await provider.locator('summary').filter({ hasText: 'Remove saved key' }).click();
	await provider.locator('details input[type="checkbox"]').check();
	await provider.getByRole('button', { name: 'Remove saved key', exact: true }).click();
	await expect(provider.getByText('No key saved', { exact: true })).toBeVisible();
	state = await (await request.get(`${fixture}/__test/state`)).json();
	expect(state.encryptedProviders).toEqual([]);
	expect(
		state.providers.find((item: { provider: string }) => item.provider === 'openrouter').enabled
	).toBe(false);
});

test('parent cannot open root administration or call staff AI, and cross-origin mutations are rejected', async ({
	page,
	request
}) => {
	await login(page, 'parent');
	const forbidden = await page.goto('/admin/ai');
	expect(forbidden?.status()).toBe(403);
	const aiResponse = await page.request.post('/api/ai/draft', {
		headers: { Origin: origin },
		data: { provider: 'openai', prompt: 'A learning activity', locale: 'en', age_band: '7-9' },
		maxRedirects: 0
	});
	expect(aiResponse.status()).toBe(403);
	const crossSite = await page.request.post('/family?/createHero', {
		headers: { Origin: 'https://untrusted.example.test' },
		form: { nickname: 'Injected', age_band: '7-9', avatar: 'leaf', locale: 'en' },
		maxRedirects: 0
	});
	expect(crossSite.status()).toBe(403);
	const state = await (await request.get(`${fixture}/__test/state`)).json();
	expect(state.children).toEqual([]);
	expect(state.encryptedProviders).toEqual([]);
});

test('invalid login stays signed out and protected routes redirect to login', async ({ page }) => {
	await page.goto('/auth/login');
	await page.getByLabel('Email', { exact: true }).fill('parent@example.test');
	await page.getByLabel('Password', { exact: true }).fill('WrongPassword123!');
	await page.getByRole('button', { name: 'Sign in', exact: true }).click();
	await expect(
		page.getByText('The email or password is not correct.', { exact: true })
	).toBeVisible();
	await expect(page).toHaveURL(/\/auth\/login/);
	await page.goto('/family');
	await expect(page).toHaveURL(/\/auth\/login\?next=/);
	await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
});
