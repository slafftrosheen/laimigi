import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Executes every migration in PostgreSQL. The Auth JWT claims are the only stub;
// no remote service, real account, password or provider key is used.
const db = new PGlite();
const ids = {
	root: '51000000-0000-4000-8000-000000000001',
	parent: '51000000-0000-4000-8000-000000000002',
	other: '51000000-0000-4000-8000-000000000003'
};
const sessions = {
	root: '52000000-0000-4000-8000-000000000001',
	parent: '52000000-0000-4000-8000-000000000002',
	other: '52000000-0000-4000-8000-000000000003',
	freshParent: '52000000-0000-4000-8000-000000000004',
	freshRoot: '52000000-0000-4000-8000-000000000005'
};
const block = '53000000-0000-4000-8000-000000000001';
const content = {
	title: 'Observe a shape',
	description: 'A local policy test lesson.',
	body: '',
	locale: 'ru',
	age_band: '7-9',
	location: 'observatory',
	status: 'published',
	blocks: [{ id: block, type: 'reading', title: 'Observe', body: 'Look at the shape.' }]
};
const rows = async (sql, params = []) => (await db.query(sql, params)).rows;
const scalar = async (sql, params = []) => Object.values((await rows(sql, params))[0])[0];
let passed = 0;
async function test(name, fn) {
	try {
		await fn();
		console.log(`ok ${++passed} - ${name}`);
	} catch (error) {
		console.error(`FAIL - ${name}`);
		throw error;
	}
}
async function asRole(role, user, session, fn, additionalClaims = {}) {
	assert(['authenticated', 'anon', 'service_role'].includes(role));
	await db.exec('begin');
	try {
		await db.exec(`set local role ${role}`);
		await db.query("select set_config('request.jwt.claim.sub',$1,true)", [user || '']);
		await db.query("select set_config('request.jwt.claims',$1,true)", [
			JSON.stringify({ ...additionalClaims, sub: user, session_id: session, role })
		]);
		const result = await fn();
		await db.exec('commit');
		return result;
	} catch (error) {
		await db.exec('rollback');
		throw error;
	}
}
const asUser = (name, fn, session = sessions[name], extra) =>
	asRole('authenticated', ids[name], session, fn, extra);
const denied = (fn, code = '42501') => assert.rejects(fn, (error) => error.code === code);
const mode = (name, session = sessions[name], extra) =>
	asUser(name, () => scalar('select public.get_child_mode()'), session, extra);
const enter = (name, hero, session = sessions[name]) =>
	asUser(name, () => scalar('select public.enter_child_mode($1)', [hero]), session);
const save = (lessonContent = content, session = sessions.root) =>
	asUser(
		'root',
		() => scalar('select public.save_lesson(null,$1::jsonb)', [JSON.stringify(lessonContent)]),
		session
	);
const submit = (name, hero, lesson, session = sessions[name]) =>
	asUser(
		name,
		() => scalar('select public.submit_lesson_block($1,$2,$3,1,null)', [hero, lesson, block]),
		session
	);
const complete = (name, hero, lesson, session = sessions[name]) =>
	asUser(
		name,
		() => scalar('select to_jsonb(public.complete_lesson_revision($1,$2,1))', [hero, lesson]),
		session
	);

try {
	await db.exec(`
		create role anon nologin;
		create role authenticated nologin;
		create role service_role nologin bypassrls;
		create schema auth;
		grant usage on schema public,auth to anon,authenticated,service_role;
		create table auth.users (
			id uuid primary key, email text not null unique, email_confirmed_at timestamptz,
			raw_user_meta_data jsonb not null default '{}'
		);
		create function auth.uid() returns uuid language sql stable as $$
			select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
		$$;
		create function auth.jwt() returns jsonb language sql stable as $$
			select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb;
		$$;
	`);
	await test('foundation, learning and child-mode migrations apply together', async () => {
		for (const file of [
			'202611240001_foundation.sql',
			'202611250001_learning_journey.sql',
			'202611250002_child_mode.sql'
		])
			await db.exec(
				await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8')
			);
		assert.equal(
			await scalar("select to_regclass('private.child_session_locks') is not null"),
			true
		);
	});
	for (const [name, id] of Object.entries(ids)) {
		await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())', [
			id,
			`${name}@example.test`
		]);
	}
	await asRole('service_role', null, null, () =>
		scalar("select public.bootstrap_root_admin('root@example.test')")
	);
	const parentFamily = await asUser('parent', () => scalar('select id from public.families'));
	async function hero(name, nickname) {
		return asUser(name, () =>
			scalar(
				`
			insert into public.child_profiles(family_id,nickname,age_band,locale)
			select id,$1,'7-9','ru' from public.families returning id`,
				[nickname]
			)
		);
	}
	const active = await hero('parent', 'Comet');
	const sibling = await hero('parent', 'Nova');
	const foreign = await hero('other', 'Orbit');
	const rootHero = await hero('root', 'Spark');
	const lesson = await save();
	await save({ ...content, locale: 'en' });
	await save({ ...content, age_band: '4-6' });
	await save({ ...content, status: 'draft' });
	await submit('parent', sibling, lesson);
	await complete('parent', sibling, lesson);

	await test('a valid adult session has normal family access and no child lock', async () => {
		assert.equal(await mode('parent'), null);
		assert.equal(
			(await asUser('parent', () => rows('select * from public.child_profiles'))).length,
			2
		);
		assert.equal(await asUser('root', () => scalar('select public.is_root_admin()')), true);
	});
	await test('missing and malformed signed session claims fail closed', async () => {
		for (const session of [null, '', 'malformed', '00000000-0000-0000-0000-not-a-session']) {
			await denied(() => mode('root', session));
			assert.equal(
				await asUser('root', () => scalar('select public.current_app_role()'), session),
				null
			);
			for (const table of ['families', 'child_profiles', 'lessons', 'user_roles', 'profiles']) {
				assert.equal(
					(await asUser('root', () => rows(`select * from public.${table}`), session)).length,
					0
				);
			}
		}
	});
	await test('anonymous callers cannot inspect or create locks', async () => {
		for (const sql of [
			'select public.get_child_mode()',
			'select public.enter_child_mode(null)',
			'select public.reserve_adult_reauth()'
		]) {
			await denied(() => asRole('anon', null, null, () => rows(sql)));
		}
	});
	await test('entering a foreign hero or null hero does not create a lock', async () => {
		await denied(() => enter('parent', foreign));
		await denied(() => enter('parent', null), '22023');
		assert.equal(await mode('parent'), null);
	});
	await test('enter installs a durable lock and repeats only for that same hero', async () => {
		assert.deepEqual(await enter('parent', active), { hero_id: active });
		assert.deepEqual(await enter('parent', active), { hero_id: active });
		await denied(() => enter('parent', sibling));
		await denied(() => enter('parent', null), '22023');
		assert.deepEqual(await mode('parent'), { hero_id: active });
		assert.equal(await scalar('select count(*)::int from private.child_session_locks'), 1);
	});
	await test('token refresh and editable user metadata cannot undo the same session lock', async () => {
		assert.deepEqual(
			await mode('parent', sessions.parent, {
				iat: 2000000000,
				exp: 2000003600,
				user_metadata: { child_mode: false, role: 'root_admin' }
			}),
			{ hero_id: active }
		);
		assert.equal(await asUser('parent', () => scalar('select public.current_app_role()')), null);
	});
	await test('a newly authenticated session is adult while the old session stays locked', async () => {
		assert.equal(await mode('parent', sessions.freshParent), null);
		assert.equal(
			(
				await asUser(
					'parent',
					() => rows('select * from public.child_profiles'),
					sessions.freshParent
				)
			).length,
			2
		);
		assert.deepEqual(await mode('parent'), { hero_id: active });
	});
	await test('locked direct database reads expose only the active hero and matching curriculum', async () => {
		for (const table of ['profiles', 'families', 'user_roles', 'ai_provider_settings']) {
			assert.equal((await asUser('parent', () => rows(`select * from public.${table}`))).length, 0);
		}
		assert.deepEqual(await asUser('parent', () => rows('select id from public.child_profiles')), [
			{ id: active }
		]);
		assert.deepEqual(await asUser('parent', () => rows('select id from public.lessons')), [
			{ id: lesson }
		]);
	});
	await test('locked sessions cannot edit adult records or mutate child profiles', async () => {
		for (const sql of [
			"update public.profiles set display_name='changed' returning id",
			"update public.families set name='changed' returning id",
			"update public.child_profiles set nickname='changed' returning id",
			'delete from public.child_profiles returning id'
		])
			assert.equal((await asUser('parent', () => rows(sql))).length, 0);
		await denied(() =>
			asUser('parent', () =>
				rows(
					`
			insert into public.child_profiles(family_id,nickname,age_band,locale)
			values($1,'New hero','7-9','ru')`,
					[parentFamily]
				)
			)
		);
		assert.equal(
			await scalar('select nickname from public.child_profiles where id=$1', [active]),
			'Comet'
		);
	});
	await test('sibling progress and rewards stay hidden and sibling learning calls are forbidden', async () => {
		for (const table of ['lesson_progress', 'lesson_block_progress', 'hero_rewards']) {
			assert.equal((await asUser('parent', () => rows(`select * from public.${table}`))).length, 0);
		}
		await denied(() => submit('parent', sibling, lesson));
		await denied(() => complete('parent', sibling, lesson));
		await denied(() => submit('parent', foreign, lesson));
	});
	await test('the active hero can complete ordered learning and earn exactly one reward', async () => {
		assert.equal((await submit('parent', active, lesson)).completed, true);
		assert.equal((await complete('parent', active, lesson)).status, 'completed');
		await complete('parent', active, lesson);
		for (const table of ['lesson_progress', 'lesson_block_progress', 'hero_rewards']) {
			assert.deepEqual(
				await asUser('parent', () => rows(`select child_profile_id from public.${table}`)),
				[{ child_profile_id: active }]
			);
		}
		assert.equal(
			await asUser('parent', () => scalar('select sum(xp)::int from public.hero_rewards')),
			25
		);
	});
	await test('locking a root administrator removes root and staff privileges too', async () => {
		assert.deepEqual(await enter('root', rootHero), { hero_id: rootHero });
		assert.equal(await asUser('root', () => scalar('select public.current_app_role()')), null);
		assert.equal(await asUser('root', () => scalar('select public.is_staff()')), false);
		assert.equal(await asUser('root', () => scalar('select public.is_root_admin()')), false);
		assert.deepEqual(await asUser('root', () => rows('select id from public.lessons')), [
			{ id: lesson }
		]);
		assert.equal(
			(await asUser('root', () => rows('select * from public.ai_provider_settings'))).length,
			0
		);
	});
	await test('a locked root cannot author, inspect answer keys, assign roles or configure AI', async () => {
		await denied(() => save());
		await denied(() =>
			asUser('root', () => rows('select public.get_lesson_blocks_for_editor($1)', [lesson]))
		);
		await denied(() =>
			asUser('root', () => rows('select public.get_lesson_editor_snapshot($1)', [lesson]))
		);
		await denied(() =>
			asUser('root', () => rows("select public.set_user_role($1,'root_admin')", [ids.parent]))
		);
		await denied(() =>
			asUser('root', () =>
				rows("select public.configure_ai_provider('openai','fixture',false,256,10)")
			)
		);
		assert.equal(
			(await asUser('root', () => rows("update public.lessons set status='draft' returning id")))
				.length,
			0
		);
		assert.equal(
			(await asUser('root', () => rows('delete from public.lessons returning id'))).length,
			0
		);
	});
	await test('the locked root can still learn with its own active hero', async () => {
		assert.equal((await submit('root', rootHero, lesson)).completed, true);
		assert.equal((await complete('root', rootHero, lesson)).status, 'completed');
		assert.deepEqual(
			await asUser('root', () => rows('select child_profile_id from public.hero_rewards')),
			[{ child_profile_id: rootHero }]
		);
		await denied(() => submit('root', active, lesson));
	});
	await test('only a new root session restores administration and the original remains locked', async () => {
		assert.equal(
			await asUser('root', () => scalar('select public.is_root_admin()'), sessions.freshRoot),
			true
		);
		assert.equal(
			(await asUser('root', () => rows('select id from public.lessons'), sessions.freshRoot))
				.length,
			4
		);
		assert.deepEqual(await mode('root'), { hero_id: rootHero });
	});
	await test('the database limits adult password attempts per locked session', async () => {
		for (let i = 0; i < 5; i++)
			await asUser('parent', () => rows('select public.reserve_adult_reauth()'));
		await denied(
			() => asUser('parent', () => rows('select public.reserve_adult_reauth()')),
			'P0001'
		);
		await enter('parent', active);
		await denied(
			() => asUser('parent', () => rows('select public.reserve_adult_reauth()')),
			'P0001'
		);
		await denied(() =>
			asUser('parent', () => rows('select public.reserve_adult_reauth()'), sessions.freshParent)
		);
		await db.query(
			"update private.child_session_locks set reauth_window_started_at=now()-interval '16 minutes' where user_id=$1",
			[ids.parent]
		);
		await asUser('parent', () => rows('select public.reserve_adult_reauth()'));
		assert.equal(
			await scalar('select reauth_attempts from private.child_session_locks where user_id=$1', [
				ids.parent
			]),
			1
		);
	});
	await test('browser roles cannot read, modify or delete private lock rows', async () => {
		for (const name of ['parent', 'root']) {
			for (const sql of [
				'select * from private.child_session_locks',
				'delete from private.child_session_locks',
				'update private.child_session_locks set reauth_attempts=0'
			])
				await denied(() => asUser(name, () => rows(sql)));
		}
		assert.equal(await scalar("select to_regprocedure('public.exit_child_mode()') is null"), true);
		assert.equal(
			await scalar("select to_regprocedure('public.unlock_child_mode()') is null"),
			true
		);
	});
	await test('deleting the active hero never unlocks an already-issued session', async () => {
		await asUser(
			'parent',
			() => rows('delete from public.child_profiles where id=$1', [active]),
			sessions.freshParent
		);
		assert.deepEqual(await mode('parent'), { hero_id: active });
		assert.equal(await asUser('parent', () => scalar('select public.current_app_role()')), null);
		assert.equal(
			(await asUser('parent', () => rows('select * from public.child_profiles'))).length,
			0
		);
		assert.equal((await asUser('parent', () => rows('select * from public.lessons'))).length, 0);
		await denied(() => enter('parent', sibling));
		await denied(() => submit('parent', active, lesson));
	});
	await test('lock records and audits contain no passwords, access tokens or refresh tokens', async () => {
		const columns = await rows(
			"select column_name from information_schema.columns where table_schema='private' and table_name='child_session_locks'"
		);
		assert.deepEqual(
			columns.map((row) => row.column_name).sort(),
			[
				'user_id',
				'session_id',
				'child_profile_id',
				'created_at',
				'reauth_window_started_at',
				'reauth_attempts'
			].sort()
		);
		const audit = await rows(
			"select details from private.audit_log where action='session.child_mode_entered'"
		);
		assert.equal(audit.length, 2);
		for (const entry of audit) assert.deepEqual(Object.keys(entry.details), ['hero_id']);
	});
	console.log(`\n${passed} child-mode SQL tests passed.`);
} finally {
	await db.close();
}
