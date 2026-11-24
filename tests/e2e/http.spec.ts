import { expect, test, type APIRequestContext } from '@playwright/test';

const fixture = 'http://127.0.0.1:54329';
const origin = 'http://127.0.0.1:4173';
const teacherId = '20000000-0000-4000-8000-000000000002';
const password = 'LocalOnlyPassword123!';

function submit(request: APIRequestContext, path: string, form: Record<string, string>) {
	return request.post(path, {
		headers: { Origin: origin, Accept: 'text/html' },
		form,
		maxRedirects: 0
	});
}

async function login(request: APIRequestContext, role: 'parent' | 'teacher' | 'root_admin') {
	const response = await submit(request, '/auth/login', {
		email: `${role}@example.test`,
		password
	});
	expect(response.status()).toBe(303);
	expect(response.headers().location).toBe('/family');
	const family = await request.get('/family');
	expect(family.status()).toBe(200);
	expect(await family.text()).toContain('Every hero starts here.');
}

test.beforeEach(async ({ request }) => {
	expect((await request.post(`${fixture}/__test/reset`)).ok()).toBeTruthy();
	expect((await submit(request, '/locale', { locale: 'en', next: '/' })).status()).toBe(303);
});

test('HTTP: verified server session carries a family through hero creation and lesson completion', async ({
	request
}) => {
	await login(request, 'parent');
	const sessionCookies = (await request.storageState()).cookies.filter((cookie) =>
		cookie.name.startsWith('sb-')
	);
	expect(sessionCookies.length).toBeGreaterThan(0);
	expect(sessionCookies.every((cookie) => cookie.httpOnly)).toBeTruthy();
	const created = await submit(request, '/family?/createHero', {
		nickname: 'Comet',
		age_band: '7-9',
		avatar: 'compass',
		locale: 'en'
	});
	expect(created.status()).toBe(200);
	expect(await created.text()).toContain('Comet');
	let state = await (await request.get(`${fixture}/__test/state`)).json();
	const hero = state.children[0];
	expect(hero.nickname).toBe('Comet');
	const world = await request.get(`/play/${hero.id}`);
	expect(world.status()).toBe(200);
	const worldHtml = await world.text();
	expect(worldHtml).toContain('An observatory discovery');
	expect(worldHtml).toContain('/learn/40000000-0000-4000-8000-000000000001');
	const lessonPath = '/learn/40000000-0000-4000-8000-000000000001';
	expect((await request.get(lessonPath)).status()).toBe(200);
	const completed = await submit(request, `${lessonPath}?/complete`, { hero_id: hero.id });
	expect(completed.status()).toBe(200);
	expect(await completed.text()).toContain('This discovery is saved for your hero.');
	expect((await submit(request, `${lessonPath}?/complete`, { hero_id: hero.id })).status()).toBe(
		200
	);
	state = await (await request.get(`${fixture}/__test/state`)).json();
	expect(state.progress).toHaveLength(1);
	expect(state.progress[0].child_profile_id).toBe(hero.id);
	expect(state.progress[0].status).toBe('completed');
	expect(await (await request.get(lessonPath)).text()).toContain(
		'This discovery is saved for your hero.'
	);
});

test('HTTP: teacher material is created as draft, edited and published through real form actions', async ({
	request
}) => {
	await login(request, 'teacher');
	const data = {
		title: 'Shapes around us',
		description: 'Look, name and compare shapes.',
		body: 'Find three shapes around the room and describe them to a grown-up.',
		locale: 'en',
		age_band: '7-9',
		location: 'workshop'
	};
	const created = await submit(request, '/studio?/create', data);
	expect(created.status()).toBe(200);
	expect(await created.text()).toContain('Shapes around us');
	let state = await (await request.get(`${fixture}/__test/state`)).json();
	const draft = state.lessons.find((item: { title: string }) => item.title === data.title);
	expect(draft.author_id).toBe(teacherId);
	expect(draft.status).toBe('draft');
	const editor = await request.get(`/studio/${draft.id}`);
	expect(editor.status()).toBe(200);
	const updated = await submit(request, `/studio/${draft.id}`, {
		...data,
		title: 'Shapes: look and compare',
		status: 'published'
	});
	expect(updated.status()).toBe(200);
	expect(await updated.text()).toContain('Shapes: look and compare');
	state = await (await request.get(`${fixture}/__test/state`)).json();
	expect(state.lessons.find((item: { id: string }) => item.id === draft.id).status).toBe(
		'published'
	);
	const library = await request.get('/learn');
	expect(library.status()).toBe(200);
	expect(await library.text()).toContain('Shapes: look and compare');
});

test('HTTP: root key configuration encrypts, preserves and removes without returning plaintext', async ({
	request
}) => {
	await login(request, 'root_admin');
	const initial = await request.get('/admin/ai');
	expect(initial.status()).toBe(200);
	expect(await initial.text()).toContain('OpenRouter');
	const key = 'local-only-provider-key-do-not-use-1234';
	const settings = {
		provider: 'openrouter',
		model: 'openai/test-model',
		enabled: 'true',
		max_output_tokens: '1024',
		daily_request_limit: '30'
	};
	const saved = await submit(request, '/admin/ai?/save', { ...settings, api_key: key });
	expect(saved.status()).toBe(200);
	const html = await saved.text();
	expect(html).toContain('Provider settings saved.');
	expect(html).not.toContain(key);
	expect(html).toContain('1234');
	expect(await (await request.get('/admin/ai')).text()).not.toContain(key);
	let state = await (await request.get(`${fixture}/__test/state`)).json();
	expect(state.encryptedProviders).toEqual(['openrouter']);
	const preserved = await submit(request, '/admin/ai?/save', {
		...settings,
		api_key: '',
		daily_request_limit: '40'
	});
	expect(preserved.status()).toBe(200);
	state = await (await request.get(`${fixture}/__test/state`)).json();
	const provider = state.providers.find(
		(item: { provider: string }) => item.provider === 'openrouter'
	);
	expect(provider.key_hint).toBe('1234');
	expect(provider.daily_request_limit).toBe(40);
	const removed = await submit(request, '/admin/ai?/remove', { provider: 'openrouter' });
	expect(removed.status()).toBe(200);
	expect(await removed.text()).toContain('Provider key removed.');
	state = await (await request.get(`${fixture}/__test/state`)).json();
	expect(state.encryptedProviders).toEqual([]);
	expect(
		state.providers.find((item: { provider: string }) => item.provider === 'openrouter').enabled
	).toBe(false);
});

test('HTTP: unauthorized administration, staff AI and cross-origin form mutation fail closed', async ({
	request
}) => {
	const anonymous = await request.get('/admin/ai', { maxRedirects: 0 });
	expect(anonymous.status()).toBe(303);
	expect(anonymous.headers().location).toContain('/auth/login?next=');
	await login(request, 'parent');
	expect((await request.get('/admin/ai')).status()).toBe(403);
	expect((await request.get('/admin/users')).status()).toBe(403);
	const keyWrite = await submit(request, '/admin/ai?/save', {
		provider: 'openai',
		model: 'test-model',
		api_key: 'not-a-real-key-1234567890',
		max_output_tokens: '1024',
		daily_request_limit: '30'
	});
	expect(keyWrite.status()).toBe(403);
	const staffAi = await request.post('/api/ai/draft', {
		headers: { Origin: origin },
		data: { provider: 'openai', prompt: 'A learning activity', locale: 'en', age_band: '7-9' },
		maxRedirects: 0
	});
	expect(staffAi.status()).toBe(403);
	const crossOrigin = await request.post('/family?/createHero', {
		headers: { Origin: 'https://untrusted.example.test' },
		form: { nickname: 'Injected', age_band: '7-9', avatar: 'leaf', locale: 'en' },
		maxRedirects: 0
	});
	expect(crossOrigin.status()).toBe(403);
	const state = await (await request.get(`${fixture}/__test/state`)).json();
	expect(state.children).toEqual([]);
	expect(state.encryptedProviders).toEqual([]);
});

test('HTTP: credential failures, redirect validation and logout preserve session boundaries', async ({
	request
}) => {
	const badLogin = await submit(request, '/auth/login', {
		email: 'parent@example.test',
		password: 'WrongPassword123!'
	});
	expect(badLogin.status()).toBe(400);
	expect((await request.get('/family', { maxRedirects: 0 })).status()).toBe(303);
	const loginResponse = await submit(request, '/auth/login', {
		email: 'parent@example.test',
		password,
		next: 'https://untrusted.example.test'
	});
	expect(loginResponse.status()).toBe(303);
	expect(loginResponse.headers().location).toBe('/family');
	const loggedOut = await submit(request, '/auth/logout', {});
	expect(loggedOut.status()).toBe(303);
	expect(loggedOut.headers().location).toBe('/');
	expect((await request.get('/family', { maxRedirects: 0 })).status()).toBe(303);
});
