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
let childLocks;
let refreshSessions;
let authoredBlocks;
let reauthAttempts;

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
				blocks: [],
				content_version: 1,
				locale: 'en',
				age_band: '7-9',
				location: 'observatory',
				status: 'published',
				created_at: NOW,
				updated_at: NOW
			}
		],
		lesson_progress: [],
		lesson_block_progress: [],
		hero_rewards: [],
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
	childLocks = new Map();
	refreshSessions = new Map();
	authoredBlocks = new Map();
	reauthAttempts = new Map();
}
reset();

function token(user, sessionId) {
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
			session_id: sessionId,
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
			role: tables.user_roles.find((row) => row.user_id === user.id)?.role,
			sessionId: payload.session_id
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
	const mode = childLocks.get(auth.sessionId);
	if (mode) {
		const hero = tables.child_profiles.find((row) => row.id === mode);
		if (name === 'child_profiles') return hero ? [hero] : [];
		if (['lesson_progress', 'lesson_block_progress', 'hero_rewards'].includes(name))
			return tables[name].filter((row) => row.child_profile_id === mode);
		if (name === 'lessons')
			return tables[name].filter(
				(row) =>
					hero &&
					row.status === 'published' &&
					row.age_band === hero.age_band &&
					row.locale === hero.locale
			);
		return [];
	}
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
		case 'lesson_block_progress':
		case 'hero_rewards':
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
	const offset = Number(search.get('offset'));
	if (offset > 0) selected = selected.slice(offset);
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
	if (
		['get_child_mode', 'enter_child_mode', 'reserve_adult_reauth'].includes(name) &&
		!auth.sessionId
	)
		return failure(response, 'Verified session required');
	if (name === 'get_child_mode')
		return send(
			response,
			200,
			childLocks.has(auth.sessionId) ? { hero_id: childLocks.get(auth.sessionId) } : null
		);
	if (name === 'enter_child_mode') {
		const hero = visible('child_profiles', auth).find((row) => row.id === input.p_child_profile_id);
		if (!hero || !auth.sessionId) return failure(response, 'Hero unavailable');
		if (childLocks.has(auth.sessionId) && childLocks.get(auth.sessionId) !== hero.id)
			return failure(response, 'Session already locked');
		childLocks.set(auth.sessionId, hero.id);
		return send(response, 200, { hero_id: hero.id });
	}
	if (name === 'reserve_adult_reauth') {
		if (!childLocks.has(auth.sessionId)) return failure(response, 'Child mode required');
		const now = Date.now();
		const recent = (reauthAttempts.get(auth.sessionId) ?? []).filter(
			(time) => now - time < 15 * 60000
		);
		if (recent.length >= 5) return failure(response, 'adult_reauth_rate_limited', 'P0001', 429);
		reauthAttempts.set(auth.sessionId, [...recent, now]);
		return send(response, 200, null);
	}
	if (
		childLocks.has(auth.sessionId) &&
		!['submit_lesson_block', 'complete_lesson_revision'].includes(name)
	)
		return failure(response, 'Adult required');
	if (
		['save_lesson', 'get_lesson_blocks_for_editor', 'get_lesson_editor_snapshot'].includes(name)
	) {
		if (!['teacher', 'admin', 'root_admin'].includes(auth.role))
			return failure(response, 'Staff required');
		let lesson = tables.lessons.find((row) => row.id === input.p_lesson_id);
		if (
			input.p_lesson_id &&
			(!lesson || (auth.role === 'teacher' && lesson.author_id !== auth.user.id))
		)
			return failure(response, 'Lesson unavailable');
		if (name === 'get_lesson_editor_snapshot')
			return send(response, 200, {
				lesson: structuredClone(lesson),
				author_blocks: authoredBlocks.get(lesson.id) ?? []
			});
		if (name === 'get_lesson_blocks_for_editor')
			return send(response, 200, authoredBlocks.get(lesson.id) ?? []);
		if (
			lesson &&
			(!input.p_expected_updated_at || input.p_expected_updated_at !== lesson.updated_at)
		)
			return failure(response, 'lesson_conflict', '22023', 400);
		const { blocks, ...metadata } = input.p_content;
		if (!lesson) {
			lesson = {
				id: randomUUID(),
				author_id: auth.user.id,
				content_version: 1,
				created_at: new Date().toISOString()
			};
			tables.lessons.push(lesson);
		} else if (
			JSON.stringify([
				lesson.body,
				lesson.locale,
				lesson.age_band,
				authoredBlocks.get(lesson.id) ?? []
			]) !== JSON.stringify([metadata.body, metadata.locale, metadata.age_band, blocks])
		)
			lesson.content_version++;
		authoredBlocks.set(lesson.id, structuredClone(blocks));
		const safeBlocks = blocks.map((block) =>
			Object.fromEntries(Object.entries(block).filter(([key]) => key !== 'correct_option_id'))
		);
		Object.assign(lesson, metadata, {
			blocks: safeBlocks,
			updated_at: new Date(
				Math.max(Date.now(), Date.parse(lesson.updated_at ?? 0) + 1)
			).toISOString()
		});
		return send(response, 200, lesson.id);
	}
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
	if (['submit_lesson_block', 'complete_lesson_revision'].includes(name)) {
		const child = visible('child_profiles', auth).find(
			(item) => item.id === input.p_child_profile_id
		);
		const lesson = visible('lessons', auth).find(
			(item) => item.id === input.p_lesson_id && item.status === 'published'
		);
		if (!child || !lesson || child.age_band !== lesson.age_band || child.locale !== lesson.locale)
			return failure(response, 'Unavailable');
		if (input.p_content_version !== lesson.content_version)
			return failure(response, 'lesson_changed', '22023', 400);
		let progress = tables.lesson_progress.find(
			(item) => item.child_profile_id === child.id && item.lesson_id === lesson.id
		);
		const completedIds = new Set(
			tables.lesson_block_progress
				.filter(
					(item) =>
						item.child_profile_id === child.id &&
						item.lesson_id === lesson.id &&
						item.content_version === lesson.content_version
				)
				.map((item) => item.block_id)
		);
		if (name === 'submit_lesson_block') {
			const index = lesson.blocks.findIndex((item) => item.id === input.p_block_id);
			if (index < 0) return failure(response, 'Unknown block', '22023', 400);
			if (lesson.blocks.slice(0, index).some((item) => !completedIds.has(item.id)))
				return failure(response, 'previous_steps_required', '22023', 400);
			const block = lesson.blocks[index];
			const answer = authoredBlocks.get(lesson.id)?.find((item) => item.id === block.id);
			const correct = block.type !== 'choice' || answer?.correct_option_id === input.p_option_id;
			if (!correct)
				return send(response, 200, {
					correct: false,
					completed: false,
					completed_count: completedIds.size,
					total_blocks: lesson.blocks.length
				});
			if (!completedIds.has(block.id))
				tables.lesson_block_progress.push({
					child_profile_id: child.id,
					lesson_id: lesson.id,
					block_id: block.id,
					content_version: lesson.content_version,
					completed_at: new Date().toISOString()
				});
			completedIds.add(block.id);
		}
		if (
			name === 'complete_lesson_revision' &&
			lesson.blocks.some((item) => !completedIds.has(item.id))
		)
			return failure(response, 'steps_required', '22023', 400);
		if (!progress) {
			progress = { child_profile_id: child.id, lesson_id: lesson.id };
			tables.lesson_progress.push(progress);
		}
		if (progress.content_version !== lesson.content_version)
			Object.assign(progress, {
				content_version: lesson.content_version,
				status: 'in_progress',
				completed_at: null
			});
		Object.assign(progress, { last_step: completedIds.size, updated_at: new Date().toISOString() });
		if (name === 'submit_lesson_block')
			return send(response, 200, {
				correct: true,
				completed: true,
				completed_count: completedIds.size,
				total_blocks: lesson.blocks.length
			});
		progress.status = 'completed';
		progress.completed_at ??= new Date().toISOString();
		if (
			!tables.hero_rewards.some(
				(item) => item.child_profile_id === child.id && item.lesson_id === lesson.id
			)
		)
			tables.hero_rewards.push({
				child_profile_id: child.id,
				lesson_id: lesson.id,
				location: lesson.location,
				xp: 25,
				earned_at: new Date().toISOString()
			});
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
				blockProgress: tables.lesson_block_progress,
				rewards: tables.hero_rewards,
				providers: tables.ai_provider_settings,
				encryptedProviders: [...secrets]
					.filter(([, value]) => value.startsWith('v1.'))
					.map(([provider]) => provider)
			});
		if (path === '/auth/v1/token' && request.method === 'POST') {
			const input = await body(request);
			const refreshing = url.searchParams.get('grant_type') === 'refresh_token';
			const existing = refreshing ? refreshSessions.get(input.refresh_token) : null;
			const user = refreshing
				? users.find((item) => item.id === existing?.userId)
				: users.find((item) => item.email === input.email && input.password === PASSWORD);
			if (!user)
				return send(response, 400, {
					code: 'invalid_credentials',
					message: 'Invalid login credentials'
				});
			const sessionId = existing?.sessionId ?? randomUUID();
			const refreshToken = `local-refresh-${randomUUID()}`;
			refreshSessions.set(refreshToken, { userId: user.id, sessionId });
			return send(response, 200, {
				access_token: token(user, sessionId),
				token_type: 'bearer',
				expires_in: 3600,
				expires_at: Math.floor(Date.now() / 1000) + 3600,
				refresh_token: refreshToken,
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
		if (childLocks.has(auth.sessionId)) return failure(response, 'Adult required');
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
