import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

// Runs the actual migration and its RLS/privilege policies in PostgreSQL WASM.
// auth.users and auth.uid() below emulate only the Supabase Auth boundary.
// No remote project, database password, API request or production data is used.
const db = new PGlite();
const ids = {
	root: '10000000-0000-4000-8000-000000000001',
	parent: '10000000-0000-4000-8000-000000000002',
	other: '10000000-0000-4000-8000-000000000003',
	teacher: '10000000-0000-4000-8000-000000000004',
	teacher2: '10000000-0000-4000-8000-000000000005',
	unverified: '10000000-0000-4000-8000-000000000006'
};
let passed = 0;

async function test(name, fn) {
	try {
		await fn();
		passed += 1;
		console.log(`ok ${passed} - ${name}`);
	} catch (error) {
		console.error(`FAIL - ${name}`);
		throw error;
	}
}

async function asRole(role, userId, fn) {
	assert(['authenticated', 'anon', 'service_role'].includes(role));
	await db.exec('begin');
	try {
		await db.exec(`set local role ${role}`);
		await db.query("select set_config('request.jwt.claim.sub', $1, true)", [userId || '']);
		const result = await fn();
		await db.exec('commit');
		return result;
	} catch (error) {
		await db.exec('rollback');
		throw error;
	}
}

const asUser = (id, fn) => asRole('authenticated', id, fn);
const asService = (fn) => asRole('service_role', null, fn);
const rows = async (sql, params = []) => (await db.query(sql, params)).rows;
const scalar = async (sql, params = []) => Object.values((await rows(sql, params))[0])[0];
const denied = async (fn, code = '42501') => {
	await assert.rejects(fn, (error) => error.code === code);
};

try {
	await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    grant usage on schema public, auth to anon, authenticated, service_role;
    create table auth.users (
      id uuid primary key,
      email text not null unique,
      email_confirmed_at timestamptz,
      raw_user_meta_data jsonb not null default '{}'::jsonb
    );
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
  `);

	await test('migration applies to a fresh PostgreSQL database', async () => {
		const migration = fileURLToPath(
			new URL('../supabase/migrations/202611240001_foundation.sql', import.meta.url)
		);
		await db.exec(await readFile(migration, 'utf8'));
	});

	for (const [name, id] of Object.entries(ids)) {
		await db.query(
			'insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values ($1,$2,$3,$4)',
			[
				id,
				`${name}@example.test`,
				name === 'unverified' ? null : new Date(),
				JSON.stringify({ display_name: name, locale: 'ru', role: 'root_admin' })
			]
		);
	}

	await test('signup creates one profile/family and ignores requested privilege', async () => {
		assert.equal(
			await scalar('select role from public.user_roles where user_id=$1', [ids.root]),
			'parent'
		);
		assert.equal(
			await scalar('select count(*)::int from public.families where owner_id=$1', [ids.root]),
			1
		);
		assert.equal(await scalar('select locale from public.profiles where id=$1', [ids.root]), 'ru');
	});

	await test('anonymous callers cannot read private family data', async () => {
		await denied(() => asRole('anon', null, () => rows('select * from public.families')));
	});

	await test('ordinary user cannot bootstrap a privileged account', async () => {
		await denied(() =>
			asUser(ids.root, () => rows("select public.bootstrap_root_admin('root@example.test')"))
		);
	});

	await test('bootstrap requires an explicitly selected verified account', async () => {
		await denied(
			() => asService(() => rows("select public.bootstrap_root_admin('unverified@example.test')")),
			'22023'
		);
		await denied(
			() => asService(() => rows("select public.bootstrap_root_admin('missing@example.test')")),
			'22023'
		);
		assert.equal(
			await asService(() => scalar("select public.bootstrap_root_admin('root@example.test')")),
			ids.root
		);
	});

	await test('bootstrap is idempotent for the root and rejects a second account', async () => {
		assert.equal(
			await asService(() => scalar("select public.bootstrap_root_admin('ROOT@example.test')")),
			ids.root
		);
		await denied(() =>
			asService(() => rows("select public.bootstrap_root_admin('parent@example.test')"))
		);
	});

	await test('roles cannot be edited directly even by the root', async () => {
		await denied(() =>
			asUser(ids.parent, () =>
				rows("update public.user_roles set role='root_admin' where user_id=$1", [ids.parent])
			)
		);
		await denied(() =>
			asUser(ids.root, () =>
				rows("update public.user_roles set role='admin' where user_id=$1", [ids.parent])
			)
		);
	});

	await test('role assignment requires root and preserves the last root', async () => {
		await denied(() =>
			asUser(ids.parent, () => rows("select public.set_user_role($1,'root_admin')", [ids.parent]))
		);
		await asUser(ids.root, () => rows("select public.set_user_role($1,'teacher')", [ids.teacher]));
		await asUser(ids.root, () => rows("select public.set_user_role($1,'teacher')", [ids.teacher2]));
		await denied(
			() => asUser(ids.root, () => rows("select public.set_user_role($1,'parent')", [ids.root])),
			'22023'
		);
	});

	const family = await scalar('select id from public.families where owner_id=$1', [ids.parent]);
	const otherFamily = await scalar('select id from public.families where owner_id=$1', [ids.other]);
	await test('family and profile reads are restricted to the account owner', async () => {
		assert.equal((await asUser(ids.parent, () => rows('select * from public.families'))).length, 1);
		assert.equal((await asUser(ids.parent, () => rows('select * from public.profiles'))).length, 1);
		assert.equal(
			(await asUser(ids.parent, () => rows('select * from public.user_roles'))).length,
			1
		);
		assert.equal(
			(
				await asUser(ids.parent, () =>
					rows('select * from public.families where id=$1', [otherFamily])
				)
			).length,
			0
		);
	});

	const child = await asUser(ids.parent, () =>
		scalar(
			"insert into public.child_profiles(family_id,nickname,age_band,avatar,locale) values ($1,'Comet','7-9','compass','ru') returning id",
			[family]
		)
	);
	const youngerChild = await asUser(ids.parent, () =>
		scalar(
			"insert into public.child_profiles(family_id,nickname,age_band) values ($1,'Leaf','4-6') returning id",
			[family]
		)
	);

	await test('a parent can create heroes only within their own family', async () => {
		await denied(() =>
			asUser(ids.parent, () =>
				rows(
					"insert into public.child_profiles(family_id,nickname,age_band) values ($1,'Intruder','7-9')",
					[otherFamily]
				)
			)
		);
		assert.equal(
			(await asUser(ids.parent, () => rows('select * from public.child_profiles'))).length,
			2
		);
	});

	await test('other families and staff cannot read or edit the children', async () => {
		assert.equal(
			(await asUser(ids.other, () => rows('select * from public.child_profiles'))).length,
			0
		);
		assert.equal(
			(await asUser(ids.teacher, () => rows('select * from public.child_profiles'))).length,
			0
		);
		assert.equal(
			(
				await asUser(ids.other, () =>
					rows("update public.child_profiles set nickname='Changed' where id=$1 returning id", [
						child
					])
				)
			).length,
			0
		);
		await denied(() =>
			asUser(ids.parent, () =>
				rows('update public.child_profiles set family_id=$1 where id=$2', [otherFamily, child])
			)
		);
	});

	await test('parents cannot create curriculum records', async () => {
		await denied(() =>
			asUser(ids.parent, () =>
				rows(
					"insert into public.lessons(author_id,title,age_band,location) values ($1,'Unauthorized','7-9','school')",
					[ids.parent]
				)
			)
		);
	});

	const lesson = await asUser(ids.teacher, () =>
		scalar(
			"insert into public.lessons(author_id,title,body,locale,age_band,location,status) values ($1,'Learn by doing','A lesson','ru','7-9','observatory','published') returning id",
			[ids.teacher]
		)
	);
	const draft = await asUser(ids.teacher, () =>
		scalar(
			"insert into public.lessons(author_id,title,age_band,location) values ($1,'Draft','7-9','school') returning id",
			[ids.teacher]
		)
	);

	await test('teachers own their lessons; parents see published content only', async () => {
		assert.equal((await asUser(ids.parent, () => rows('select * from public.lessons'))).length, 1);
		assert.equal((await asUser(ids.teacher, () => rows('select * from public.lessons'))).length, 2);
		assert.equal(
			(await asUser(ids.teacher2, () => rows('select * from public.lessons where id=$1', [draft])))
				.length,
			0
		);
		assert.equal(
			(
				await asUser(ids.teacher2, () =>
					rows("update public.lessons set title='Changed' where id=$1 returning id", [lesson])
				)
			).length,
			0
		);
		await denied(() =>
			asUser(ids.teacher, () =>
				rows('update public.lessons set author_id=$1 where id=$2', [ids.teacher2, lesson])
			)
		);
	});

	await test('completion requires ownership, age match, and a published lesson', async () => {
		await denied(() =>
			asUser(ids.other, () => rows('select public.complete_lesson($1,$2)', [child, lesson]))
		);
		await denied(
			() =>
				asUser(ids.parent, () =>
					rows('select public.complete_lesson($1,$2)', [youngerChild, lesson])
				),
			'22023'
		);
		await denied(
			() => asUser(ids.parent, () => rows('select public.complete_lesson($1,$2)', [child, draft])),
			'22023'
		);
		await asUser(ids.parent, () => rows('select public.complete_lesson($1,$2)', [child, lesson]));
	});

	await test('completion is idempotent and cannot be forged by direct mutation', async () => {
		const original = await scalar(
			'select completed_at from public.lesson_progress where child_profile_id=$1',
			[child]
		);
		await asUser(ids.parent, () => rows('select public.complete_lesson($1,$2)', [child, lesson]));
		assert.equal(
			await scalar('select count(*)::int from public.lesson_progress where child_profile_id=$1', [
				child
			]),
			1
		);
		assert.deepEqual(
			await scalar('select completed_at from public.lesson_progress where child_profile_id=$1', [
				child
			]),
			original
		);
		await denied(() =>
			asUser(ids.parent, () =>
				rows("update public.lesson_progress set status='in_progress' where child_profile_id=$1", [
					child
				])
			)
		);
		assert.equal(
			(await asUser(ids.other, () => rows('select * from public.lesson_progress'))).length,
			0
		);
		assert.equal(
			(await asUser(ids.parent, () => rows('select * from public.lesson_progress'))).length,
			1
		);
	});

	await test('provider metadata is visible only to root and server', async () => {
		assert.equal(
			(await asUser(ids.parent, () => rows('select * from public.ai_provider_settings'))).length,
			0
		);
		assert.equal(
			(await asUser(ids.teacher, () => rows('select * from public.ai_provider_settings'))).length,
			0
		);
		assert.equal(
			(await asUser(ids.root, () => rows('select * from public.ai_provider_settings'))).length,
			2
		);
		assert.equal(
			(await asService(() => rows('select * from public.ai_provider_settings'))).length,
			2
		);
	});

	const fakeCiphertext = 'TEST_CIPHERTEXT_ENVELOPE_NEVER_A_REAL_KEY_1234567890';
	const configure = (user, { enabled = true, limit = 100, cipher = null, remove = false } = {}) =>
		asUser(user, () =>
			rows('select * from public.configure_ai_provider($1,$2,$3,$4,$5,$6,$7,$8)', [
				'openai',
				'test-model',
				enabled,
				1024,
				limit,
				cipher,
				cipher ? '7890' : null,
				remove
			])
		);

	await test('only root can configure; enabling requires a saved credential', async () => {
		await denied(() => configure(ids.teacher, { cipher: fakeCiphertext }));
		await denied(() => configure(ids.root), '22023');
		await denied(() =>
			asUser(ids.root, () =>
				rows("update public.ai_provider_settings set enabled=true where provider='openai'")
			)
		);
	});

	await test('key configuration returns masked metadata without ciphertext', async () => {
		const [settings] = await configure(ids.root, { cipher: fakeCiphertext, limit: 2 });
		assert.equal(settings.key_hint, '7890');
		assert.equal(settings.enabled, true);
		assert.equal('ciphertext' in settings, false);
		assert.equal(JSON.stringify(settings).includes(fakeCiphertext), false);
	});

	await test('neither root nor teachers can read ciphertext through browser permissions', async () => {
		await denied(() => asUser(ids.root, () => rows('select * from private.ai_provider_secrets')));
		await denied(() =>
			asUser(ids.teacher, () => rows("select public.get_ai_provider_secret('openai')"))
		);
		await denied(() =>
			asUser(ids.root, () => rows("select public.get_ai_provider_secret('openai')"))
		);
		assert.equal(
			await asService(() => scalar("select public.get_ai_provider_secret('openai')")),
			fakeCiphertext
		);
	});

	await test('invalid key removal rolls back without losing the working credential', async () => {
		await denied(() => configure(ids.root, { remove: true }), '22023');
		assert.equal(
			await asService(() => scalar("select public.get_ai_provider_secret('openai')")),
			fakeCiphertext
		);
	});

	await test('AI request reservation requires the server and a staff actor', async () => {
		await denied(() =>
			asUser(ids.teacher, () =>
				rows("select public.reserve_ai_request($1,'openai')", [ids.teacher])
			)
		);
		await denied(() =>
			asService(() => rows("select public.reserve_ai_request($1,'openai')", [ids.parent]))
		);
	});

	let requestId;
	await test('daily cap includes failed requests and rejects another reservation', async () => {
		requestId = await asService(() =>
			scalar("select public.reserve_ai_request($1,'openai')", [ids.teacher])
		);
		await asService(() => rows("select public.finish_ai_request($1,'failed')", [requestId]));
		await asService(() => rows("select public.reserve_ai_request($1,'openai')", [ids.teacher2]));
		await denied(
			() => asService(() => rows("select public.reserve_ai_request($1,'openai')", [ids.root])),
			'P0001'
		);
		assert.equal(
			await scalar('select status from private.ai_usage where id=$1', [requestId]),
			'failed'
		);
	});

	await test('a request can finish only once, with an accepted terminal status', async () => {
		await asService(() => rows("select public.finish_ai_request($1,'succeeded')", [requestId]));
		assert.equal(
			await scalar('select status from private.ai_usage where id=$1', [requestId]),
			'failed'
		);
		await denied(
			() => asService(() => rows("select public.finish_ai_request($1,'anything')", [requestId])),
			'22023'
		);
	});

	await test('per-user minute cap is enforced independently of the daily cap', async () => {
		await configure(ids.root, { limit: 100 });
		for (let i = 0; i < 4; i++) {
			await asService(() => rows("select public.reserve_ai_request($1,'openai')", [ids.teacher]));
		}
		await denied(
			() => asService(() => rows("select public.reserve_ai_request($1,'openai')", [ids.teacher])),
			'P0001'
		);
	});

	await test('disabling a provider immediately blocks new reservations', async () => {
		await configure(ids.root, { enabled: false });
		await denied(
			() => asService(() => rows("select public.reserve_ai_request($1,'openai')", [ids.root])),
			'22023'
		);
	});

	await test('root can remove a key and reset its visible hint', async () => {
		const [settings] = await configure(ids.root, { enabled: false, remove: true });
		assert.equal(settings.key_hint, null);
		assert.equal(
			await asService(() => scalar("select public.get_ai_provider_secret('openai')")),
			null
		);
	});

	await test('role revocation applies to the next request reservation', async () => {
		await configure(ids.root, { cipher: fakeCiphertext });
		await asUser(ids.root, () => rows("select public.set_user_role($1,'parent')", [ids.teacher2]));
		await denied(() =>
			asService(() => rows("select public.reserve_ai_request($1,'openai')", [ids.teacher2]))
		);
	});

	await test('audit records exist without credential or prompt content', async () => {
		const audit = await rows('select * from private.audit_log');
		assert(audit.length >= 5);
		assert.equal(JSON.stringify(audit).includes(fakeCiphertext), false);
		assert.equal(JSON.stringify(audit).includes('ciphertext'), false);
		await denied(() => asUser(ids.root, () => rows('delete from private.audit_log')));
	});

	console.log(`\n${passed} database/security checks passed against the actual migration.`);
} finally {
	await db.close();
}
