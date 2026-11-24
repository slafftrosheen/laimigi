// Local-only HTTP fixture for browser integration tests. Never import into app code.
// The SQL migration/RLS rules are independently exercised by scripts/db-test.mjs.
import { createServer } from 'node:http';
import { createHmac, randomUUID } from 'node:crypto';

const PORT = 54329;
const PASSWORD = 'LocalOnlyPassword123!';
const NOW = '2026-11-24T12:00:00.000Z';
const ACCOUNT_IDS = {
	parent: '20000000-0000-4000-8000-000000000001',
	teacher: '20000000-0000-4000-8000-000000000002',
	root_admin: '20000000-0000-4000-8000-000000000003'
};
const users = Object.entries(ACCOUNT_IDS).map(([role, id]) => ({
	id,
	email: `${role}@example.test`,
	aud: 'authenticated',
	role: 'authenticated',
	app_metadata: { provider: 'email', providers: ['email'] },
	user_metadata: { locale: 'en' },
	email_confirmed_at: NOW,
	confirmed_at: NOW,
	created_at: NOW,
	updated_at: NOW,
	last_sign_in_at: NOW,
	identities: []
}));
let tables;
let secrets;

function reset() {
	tables = {
		user_roles: Object.entries(ACCOUNT_IDS).map(([role, user_id]) => ({
			user_id,
			role,
			updated_at: NOW
		})),
		profiles: users.map((user) => ({ id: user.id, display_name: '', locale: 'en' })),
		families: users.map((user, index) => ({
			id: `30000000-0000-4000-8000-00000000000${index + 1}`,
			owner_id: user.id,
			name: '',
			created_at: NOW
		})),
		child_profiles: [],
		lessons: [
			{
				id: '40000000-0000-4000-8000-000000000001',
				author_id: ACCOUNT_IDS.teacher,
				title: 'An observatory discovery',
				description: 'A short local test activity.',
				body: 'Look closely, describe what you notice, and share one question with an adult.',
				locale: 'en',
				age_band: '7-9',
				location: 'observatory',
				status: 'published',
				created_at: NOW,
				updated_at: NOW
			}
		],
		lesson_progress: [],
		ai_provider_settings: ['openrouter', 'openai'].map((provider) => ({
			provider,
			model: '',
			enabled: false,
			max_output_tokens: 1024,
			daily_request_limit: 100,
			key_hint: null,
			updated_at: NOW,
			updated_by: null
		}))
	};
	secrets = new Map();
}
reset();

function token(user) {
	const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
	const payload = Buffer.from(
		JSON.stringify({
			sub: user.id,
			aud: 'authenticated',
			role: 'authenticated',
			email: user.email,
			iss: `http://127.0.0.1:${PORT}/auth/v1`,
			iat: Math.floor(Date.now() / 1000),
			exp: Math.floor(Date.now() / 1000) + 3600,
			aal: 'aal1',
			session_id: '50000000-0000-4000-8000-000000000001',
			is_anonymous: false
		})
	).toString('base64url');
	const signature = createHmac('sha256', 'local-fixture-signing-key-not-for-deployment')
		.update(`${header}.${payload}`)
		.digest('base64url');
	return `${header}.${payload}.${signature}`;
}

function actor(request) {
	const bearer = request.headers.authorization?.replace(/^Bearer /i, '');
	if (bearer === 'test-service') return { service: true, user: null, role: 'service_role' };
	try {
		const payload = JSON.parse(Buffer.from(bearer.split('.')[1], 'base64url').toString());
		const user = users.find((item) => item.id === payload.sub);
		if (!user) return null;
		return {
			service: false,
			user,
			role: tables.user_roles.find((row) => row.user_id === user.id)?.role
		};
	} catch {
		return null;
	}
}

async function body(request) {
	const chunks = [];
	for await (const chunk of request) chunks.push(chunk);
	const value = Buffer.concat(chunks).toString();
	return value ? JSON.parse(value) : {};
}

function send(response, status, value, headers = {}) {
	response.writeHead(status, {
		'Content-Type': 'application/json',
		'Cache-Control': 'no-store',
		'X-Supabase-Api-Version': '2024-01-01',
		...headers
	});
	response.end(value === undefined ? '' : JSON.stringify(value));
}

function failure(response, message, code = '42501', status = 403) {
	send(response, status, { message, code, details: null, hint: null });
}

function visible(name, auth) {
	if (auth.service) return tables[name];
	const family = tables.families.find((item) => item.owner_id === auth.user.id);
	const ownedChildIds = tables.child_profiles
		.filter((item) => item.family_id === family?.id)
		.map((item) => item.id);
	switch (name) {
		case 'profiles':
			return tables[name].filter((item) => item.id === auth.user.id);
		case 'user_roles':
			return tables[name].filter(
				(item) => item.user_id === auth.user.id || auth.role === 'root_admin'
			);
		case 'families':
			return tables[name].filter((item) => item.owner_id === auth.user.id);
		case 'child_profiles':
			return tables[name].filter((item) => item.family_id === family?.id);
		case 'lesson_progress':
			return tables[name].filter((item) => ownedChildIds.includes(item.child_profile_id));
		case 'ai_provider_settings':
			return auth.role === 'root_admin' ? tables[name] : [];
		case 'lessons':
			return tables[name].filter(
				(item) =>
					item.status === 'published' ||
					item.author_id === auth.user.id ||
					['admin', 'root_admin'].includes(auth.role)
			);
		default:
			return [];
	}
}

function filtered(items, search) {
	let selected = [...items];
	for (const [key, filter] of search) {
		if (filter.startsWith('eq.'))
			selected = selected.filter((item) => String(item[key]) === filter.slice(3));
		if (filter.startsWith('in.(')) {
			const choices = filter
				.slice(4, -1)
				.split(',')
				.map((part) => part.replace(/^"|"$/g, ''));
			selected = selected.filter((item) => choices.includes(String(item[key])));
		}
	}
	const order = search.get('order');
	if (order) {
		const [key, direction] = order.split('.');
		selected.sort(
			(a, b) => String(a[key]).localeCompare(String(b[key])) * (direction === 'desc' ? -1 : 1)
		);
	}
	const limit = Number(search.get('limit'));
	if (limit > 0) selected = selected.slice(0, limit);
	return selected;
}

function representation(request, response, rows, search, status = 200) {
	const select = search.get('select');
	const projected =
		!select || select === '*'
			? rows
			: rows.map((row) =>
					Object.fromEntries(select.split(',').map((column) => [column, row[column]]))
				);
	const headers = {
		'Content-Range': rows.length ? `0-${rows.length - 1}/${rows.length}` : '*/0'
	};
	if (request.method === 'HEAD') return send(response, 200, undefined, headers);
	if (request.headers.accept?.includes('application/vnd.pgrst.object+json')) {
		if (projected.length !== 1)
			return send(response, 406, {
				code: 'PGRST116',
				details: `The result contains ${projected.length} rows`,
				hint: null,
				message: 'JSON object requested, multiple (or no) rows returned'
			});
		return send(response, status, projected[0], headers);
	}
	return send(response, status, projected, headers);
}

async function rpc(name, input, auth, response) {
	if (name === 'configure_ai_provider') {
		if (auth.role !== 'root_admin') return failure(response, 'Root required');
		const settings = tables.ai_provider_settings.find((item) => item.provider === input.p_provider);
		if (!settings) return failure(response, 'Unknown provider', '22023', 400);
		if (input.p_ciphertext) secrets.set(input.p_provider, input.p_ciphertext);
		if (input.p_remove_key) secrets.delete(input.p_provider);
		if (input.p_enabled && !secrets.has(input.p_provider))
			return failure(response, 'Key missing', '22023', 400);
		Object.assign(settings, {
			model: input.p_model,
			enabled: input.p_enabled,
			max_output_tokens: input.p_max_output_tokens,
			daily_request_limit: input.p_daily_request_limit,
			key_hint: input.p_remove_key
				? null
				: input.p_ciphertext
					? input.p_key_hint
					: settings.key_hint,
			updated_at: new Date().toISOString(),
			updated_by: auth.user.id
		});
		return send(response, 200, settings);
	}
	if (name === 'complete_lesson') {
		const child = visible('child_profiles', auth).find(
			(item) => item.id === input.p_child_profile_id
		);
		const lesson = tables.lessons.find(
			(item) => item.id === input.p_lesson_id && item.status === 'published'
		);
		if (!child || !lesson || child.age_band !== lesson.age_band)
			return failure(response, 'Unavailable');
		let progress = tables.lesson_progress.find(
			(item) => item.child_profile_id === child.id && item.lesson_id === lesson.id
		);
		if (!progress) {
			progress = {
				child_profile_id: child.id,
				lesson_id: lesson.id,
				status: 'completed',
				completed_at: new Date().toISOString(),
				last_step: 0,
				updated_at: new Date().toISOString()
			};
			tables.lesson_progress.push(progress);
		}
		return send(response, 200, progress);
	}
	if (name === 'set_user_role') {
		if (auth.role !== 'root_admin') return failure(response, 'Root required');
		const userRole = tables.user_roles.find((item) => item.user_id === input.p_user_id);
		if (!userRole) return failure(response, 'Unknown account', '22023', 400);
		if (
			userRole.role === 'root_admin' &&
			input.p_role !== 'root_admin' &&
			tables.user_roles.filter((item) => item.role === 'root_admin').length === 1
		) {
			return failure(response, 'Last root', '22023', 400);
		}
		userRole.role = input.p_role;
		return send(response, 200, null);
	}
	return failure(
		response,
		`RPC not implemented by local fixture: ${name}`,
		'TEST_NOT_IMPLEMENTED',
		501
	);
}

const server = createServer(async (request, response) => {
	try {
		const url = new URL(request.url, `http://127.0.0.1:${PORT}`);
		const path = url.pathname;
		if (path === '/health') return send(response, 200, { fixture: true });
		if (path === '/__test/reset' && request.method === 'POST') {
			reset();
			return send(response, 200, { reset: true });
		}
		if (path === '/__test/state')
			return send(response, 200, {
				children: tables.child_profiles,
				lessons: tables.lessons,
				progress: tables.lesson_progress,
				providers: tables.ai_provider_settings,
				encryptedProviders: [...secrets]
					.filter(([, value]) => value.startsWith('v1.'))
					.map(([provider]) => provider)
			});
		if (path === '/auth/v1/token' && request.method === 'POST') {
			const input = await body(request);
			const user =
				url.searchParams.get('grant_type') === 'refresh_token'
					? users.find((item) => `local-refresh-${item.id}` === input.refresh_token)
					: users.find((item) => item.email === input.email && input.password === PASSWORD);
			if (!user)
				return send(response, 400, {
					code: 'invalid_credentials',
					message: 'Invalid login credentials'
				});
			return send(response, 200, {
				access_token: token(user),
				token_type: 'bearer',
				expires_in: 3600,
				expires_at: Math.floor(Date.now() / 1000) + 3600,
				refresh_token: `local-refresh-${user.id}`,
				user
			});
		}
		const auth = actor(request);
		if (path === '/auth/v1/user') {
			if (!auth?.user) return send(response, 401, { code: 'bad_jwt', message: 'Invalid token' });
			return send(response, 200, auth.user);
		}
		if (path === '/auth/v1/logout') return send(response, 204);
		if (path === '/auth/v1/admin/users' && auth?.service)
			return send(response, 200, { users, aud: 'authenticated', total: users.length });
		if (!auth) return failure(response, 'No local test session', '42501', 401);
		if (path.startsWith('/rest/v1/rpc/'))
			return rpc(path.split('/').at(-1), await body(request), auth, response);
		const name = path.split('/').at(-1);
		if (!path.startsWith('/rest/v1/') || !tables[name])
			return failure(response, 'Unknown fixture route', '404', 404);
		if (request.method === 'GET' || request.method === 'HEAD') {
			return representation(
				request,
				response,
				filtered(visible(name, auth), url.searchParams),
				url.searchParams
			);
		}
		let changed = [];
		if (request.method === 'POST' && ['child_profiles', 'lessons'].includes(name)) {
			const input = await body(request);
			const incoming = Array.isArray(input) ? input : [input];
			for (const value of incoming) {
				if (
					name === 'child_profiles' &&
					!visible('families', auth).some((family) => family.id === value.family_id)
				)
					return failure(response, 'Family mismatch');
				if (name === 'lessons' && !['teacher', 'admin', 'root_admin'].includes(auth.role))
					return failure(response, 'Staff required');
				const record = {
					id: randomUUID(),
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
					...value
				};
				tables[name].push(record);
				changed.push(record);
			}
		} else if (['PATCH', 'DELETE'].includes(request.method)) {
			changed = filtered(visible(name, auth), url.searchParams);
			if (name === 'lessons')
				changed = changed.filter(
					(item) =>
						['admin', 'root_admin'].includes(auth.role) ||
						(auth.role === 'teacher' && item.author_id === auth.user.id)
				);
			if (request.method === 'PATCH') {
				const input = await body(request);
				changed.forEach((item) =>
					Object.assign(item, input, { updated_at: new Date().toISOString() })
				);
			} else {
				tables[name] = tables[name].filter((item) => !changed.includes(item));
			}
		} else return failure(response, 'Unsupported fixture mutation', 'TEST_NOT_IMPLEMENTED', 501);
		if (request.headers.prefer?.includes('return=representation')) {
			return representation(
				request,
				response,
				changed,
				url.searchParams,
				request.method === 'POST' ? 201 : 200
			);
		}
		return send(response, request.method === 'POST' ? 201 : 204);
	} catch {
		// Do not emit request bodies or credentials, even for the local fixture.
		failure(response, 'Local fixture request failed', 'TEST_FIXTURE_ERROR', 500);
	}
});

server.listen(PORT, '127.0.0.1', () =>
	console.log(`Local Supabase test fixture listening on 127.0.0.1:${PORT}`)
);
for (const signal of ['SIGTERM', 'SIGINT'])
	process.on(signal, () => server.close(() => process.exit(0)));
