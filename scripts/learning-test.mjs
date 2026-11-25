import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Real PostgreSQL migrations and permissions; only Supabase Auth is stubbed.
// No remote database, provider request, credentials or real family data.
const db = new PGlite();
const ids = {
	root: '11000000-0000-4000-8000-000000000001',
	parent: '11000000-0000-4000-8000-000000000002',
	other: '11000000-0000-4000-8000-000000000003',
	teacher: '11000000-0000-4000-8000-000000000004',
	teacher2: '11000000-0000-4000-8000-000000000005',
	admin: '11000000-0000-4000-8000-000000000006'
};
const blockIds = {
	reading: '22000000-0000-4000-8000-000000000001',
	choice: '22000000-0000-4000-8000-000000000002',
	reflection: '22000000-0000-4000-8000-000000000003',
	correct: '33000000-0000-4000-8000-000000000001',
	incorrect: '33000000-0000-4000-8000-000000000002',
	unknown: '44000000-0000-4000-8000-000000000001'
};
const content = {
	title: 'Look, choose and explain',
	description: 'A short observation journey.',
	body: '',
	locale: 'en',
	age_band: '7-9',
	location: 'observatory',
	status: 'published',
	blocks: [
		{ id: blockIds.reading, type: 'reading', title: 'Look closely', body: 'Observe the shapes.' },
		{
			id: blockIds.choice,
			type: 'choice',
			prompt: 'Which shape has three sides?',
			options: [
				{ id: blockIds.correct, label: 'Triangle' },
				{ id: blockIds.incorrect, label: 'Circle' }
			],
			correct_option_id: blockIds.correct
		},
		{ id: blockIds.reflection, type: 'reflection', prompt: 'Explain your choice to a grown-up.' }
	]
};
const rows = async (sql, params = []) => (await db.query(sql, params)).rows;
const scalar = async (sql, params = []) => Object.values((await rows(sql, params))[0])[0];
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
		await db.query("select set_config('request.jwt.claims', $1, true)", [
			JSON.stringify({ sub: userId, session_id: userId, role })
		]);
		const result = await fn();
		await db.exec('commit');
		return result;
	} catch (error) {
		await db.exec('rollback');
		throw error;
	}
}
const asUser = (user, fn) => asRole('authenticated', user, fn);
const denied = (fn, code = '42501', message) =>
	assert.rejects(fn, (error) => error.code === code && (!message || error.message === message));
const save = async (user, lessonId = null, lessonContent = content, expectedUpdatedAt) => {
	// Keep PostgreSQL's exact microseconds. JS Date would truncate an edit token.
	const token =
		expectedUpdatedAt !== undefined
			? expectedUpdatedAt
			: lessonId
				? await scalar('select updated_at::text from public.lessons where id=$1', [lessonId])
				: null;
	return asUser(user, () =>
		scalar('select public.save_lesson($1,$2::jsonb,$3)', [
			lessonId,
			JSON.stringify(lessonContent),
			token
		])
	);
};
const snapshot = (user, lessonId) =>
	asUser(user, () => scalar('select public.get_lesson_editor_snapshot($1)', [lessonId]));
const submit = (user, hero, lesson, block, version = 1, option = null) =>
	asUser(user, () =>
		scalar('select public.submit_lesson_block($1,$2,$3,$4,$5)', [
			hero,
			lesson,
			block,
			version,
			option
		])
	);
const complete = (user, hero, lesson, version = 1) =>
	asUser(user, () =>
		scalar('select to_jsonb(public.complete_lesson_revision($1,$2,$3))', [hero, lesson, version])
	);

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
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
    $$;
  `);
	await db.exec(
		await readFile(
			new URL('../supabase/migrations/202611240001_foundation.sql', import.meta.url),
			'utf8'
		)
	);
	for (const [name, id] of Object.entries(ids)) {
		await db.query('insert into auth.users(id,email,email_confirmed_at) values ($1,$2,now())', [
			id,
			`${name}@example.test`
		]);
	}
	for (const [name, role] of [
		['root', 'root_admin'],
		['teacher', 'teacher'],
		['teacher2', 'teacher'],
		['admin', 'admin']
	]) {
		await db.query('update public.user_roles set role=$1 where user_id=$2', [role, ids[name]]);
	}
	async function hero(owner, nickname, age = '7-9', locale = 'en') {
		return asUser(owner, () =>
			scalar(
				`insert into public.child_profiles(family_id,nickname,age_band,locale)
      select id,$2,$3,$4 from public.families where owner_id=$1 returning id`,
				[owner, nickname, age, locale]
			)
		);
	}
	const child = await hero(ids.parent, 'Comet');
	const sibling = await hero(ids.parent, 'Nova');
	const youngChild = await hero(ids.parent, 'Leaf', '4-6');
	const russianChild = await hero(ids.parent, 'Spark', '7-9', 'ru');
	const otherChild = await hero(ids.other, 'Orbit');
	const legacy = await scalar(
		`insert into public.lessons(author_id,title,body,locale,age_band,location,status)
    values ($1,'An earlier material','A previously completed reading material.','en','7-9','library','published') returning id`,
		[ids.teacher]
	);
	const oldProgress = await asUser(ids.parent, () =>
		scalar('select to_jsonb(public.complete_lesson($1,$2))', [child, legacy])
	);

	await test('learning migration applies over existing lessons and completion records', async () => {
		await db.exec(
			await readFile(
				new URL('../supabase/migrations/202611250001_learning_journey.sql', import.meta.url),
				'utf8'
			)
		);
		assert.equal(
			await scalar('select content_version from public.lessons where id=$1', [legacy]),
			1
		);
		assert.deepEqual(await scalar('select blocks from public.lessons where id=$1', [legacy]), []);
		const reward = (
			await rows('select * from public.hero_rewards where child_profile_id=$1 and lesson_id=$2', [
				child,
				legacy
			])
		)[0];
		assert.equal(reward.xp, 25);
		assert.equal(
			new Date(reward.earned_at).toISOString(),
			new Date(oldProgress.completed_at).toISOString()
		);
	});

	await test('legacy plain-text completion remains revision-bound and awards no duplicate XP', async () => {
		const result = await complete(ids.parent, child, legacy);
		assert.equal(result.status, 'completed');
		assert.equal(result.completed_at, oldProgress.completed_at);
		assert.equal(
			await scalar(
				'select count(*)::int from public.hero_rewards where child_profile_id=$1 and lesson_id=$2',
				[child, legacy]
			),
			1
		);
		await denied(() =>
			asUser(ids.parent, () => rows('select public.complete_lesson($1,$2)', [child, legacy]))
		);
		await denied(() => complete(ids.parent, child, legacy, 0), '22023', 'lesson_changed');
	});

	await test('only staff can create authored lessons; anonymous and service RPC calls are denied', async () => {
		await denied(() => save(ids.parent));
		await denied(() =>
			asRole('anon', null, () =>
				rows('select public.save_lesson(null,$1)', [JSON.stringify(content)])
			)
		);
		await denied(() =>
			asRole('service_role', null, () =>
				rows('select public.save_lesson(null,$1)', [JSON.stringify(content)])
			)
		);
	});

	const lesson = await save(ids.teacher);
	await test('author creation atomically separates public blocks and private answer keys', async () => {
		const saved = (
			await asUser(ids.parent, () => rows('select * from public.lessons where id=$1', [lesson]))
		)[0];
		assert.equal(saved.author_id, ids.teacher);
		assert.equal(saved.content_version, 1);
		assert.equal(saved.blocks.length, 3);
		assert.equal(JSON.stringify(saved).includes('correct_option_id'), false);
		assert.equal(
			await scalar('select correct_option_id from private.lesson_answer_keys where lesson_id=$1', [
				lesson
			]),
			blockIds.correct
		);
		assert.deepEqual(
			await asUser(ids.teacher, () =>
				scalar('select public.get_lesson_blocks_for_editor($1)', [lesson])
			),
			content.blocks
		);
		const editor = await snapshot(ids.teacher, lesson);
		assert.equal(editor.lesson.id, lesson);
		assert.equal(editor.lesson.content_version, 1);
		assert.equal(typeof editor.lesson.updated_at, 'string');
		assert.equal(JSON.stringify(editor.lesson).includes('correct_option_id'), false);
		assert.deepEqual(editor.author_blocks, content.blocks);
	});

	await test('parents and unrelated teachers cannot retrieve answer keys or edit another teacher lesson', async () => {
		for (const user of [ids.parent, ids.other, ids.teacher2]) {
			await denied(() => asUser(user, () => rows('select * from private.lesson_answer_keys')));
			await denied(() =>
				asUser(user, () => rows('select public.get_lesson_blocks_for_editor($1)', [lesson]))
			);
			await denied(() => snapshot(user, lesson));
			await denied(() => save(user, lesson));
		}
		await denied(() => asUser(ids.root, () => rows('select * from private.lesson_answer_keys')));
		assert.deepEqual(
			await asUser(ids.admin, () =>
				scalar('select public.get_lesson_blocks_for_editor($1)', [lesson])
			),
			content.blocks
		);
		assert.equal(await save(ids.admin, lesson), lesson);
		assert.equal(
			await scalar('select author_id from public.lessons where id=$1', [lesson]),
			ids.teacher
		);
	});

	await test('browser cannot directly mutate learning content, revision, confirmations or XP', async () => {
		for (const column of ['body', 'locale', 'age_band', 'blocks', 'content_version']) {
			await denied(() =>
				asUser(ids.teacher, () =>
					rows(`update public.lessons set ${column}=${column} where id=$1`, [lesson])
				)
			);
		}
		await denied(() =>
			asUser(ids.teacher, () =>
				rows(
					`insert into public.lessons(author_id,title,age_band,location)
        values ($1,'Bypass','7-9','school')`,
					[ids.teacher]
				)
			)
		);
		await denied(() =>
			asUser(ids.parent, () =>
				rows(
					'insert into public.lesson_block_progress(child_profile_id,lesson_id,block_id,content_version) values ($1,$2,$3,1)',
					[child, lesson, blockIds.reflection]
				)
			)
		);
		await denied(() =>
			asUser(ids.parent, () =>
				rows("update public.lesson_progress set status='completed' where child_profile_id=$1", [
					child
				])
			)
		);
		await denied(() =>
			asUser(ids.parent, () =>
				rows(
					"insert into public.hero_rewards(child_profile_id,lesson_id,location) values ($1,$2,'observatory')",
					[child, lesson]
				)
			)
		);
		await denied(() =>
			asUser(ids.parent, () =>
				rows('update public.hero_rewards set xp=25000 where child_profile_id=$1', [child])
			)
		);
		await denied(() =>
			asUser(ids.root, () =>
				rows('delete from public.hero_rewards where child_profile_id=$1', [child])
			)
		);
	});

	const invalidPayloads = [
		['non-object content', null],
		[
			'missing required blocks',
			Object.fromEntries(Object.entries(content).filter(([key]) => key !== 'blocks'))
		],
		['unknown metadata', { ...content, author_id: ids.root }],
		['short title', { ...content, title: 'ab' }],
		['long title', { ...content, title: 't'.repeat(121) }],
		['long description', { ...content, description: 'd'.repeat(401) }],
		['long overview', { ...content, body: 'b'.repeat(20001) }],
		['invalid locale', { ...content, locale: 'uk' }],
		['invalid league', { ...content, age_band: 'adult' }],
		['invalid place', { ...content, location: 'unknown' }],
		['invalid status', { ...content, status: 'reviewed' }],
		['empty legacy material', { ...content, blocks: [], body: ' ' }],
		['non-array blocks', { ...content, blocks: {} }],
		[
			'too many blocks',
			{
				...content,
				blocks: Array.from({ length: 13 }, (_, i) => ({
					...content.blocks[0],
					id: `55000000-0000-4000-8000-${String(i).padStart(12, '0')}`
				}))
			}
		],
		['duplicate blocks', { ...content, blocks: [content.blocks[0], content.blocks[0]] }],
		['invalid block UUID', { ...content, blocks: [{ ...content.blocks[0], id: 'x' }] }],
		[
			'unknown block type',
			{ ...content, blocks: [{ id: blockIds.reading, type: 'script', body: 'alert(1)' }] }
		],
		['empty reading', { ...content, blocks: [{ ...content.blocks[0], body: ' ' }] }],
		['long reading', { ...content, blocks: [{ ...content.blocks[0], body: 'x'.repeat(6001) }] }],
		['numeric reading title', { ...content, blocks: [{ ...content.blocks[0], title: 42 }] }],
		[
			'missing answer key',
			{
				...content,
				blocks: [
					Object.fromEntries(
						Object.entries(content.blocks[1]).filter(([key]) => key !== 'correct_option_id')
					)
				]
			}
		],
		[
			'answer outside options',
			{ ...content, blocks: [{ ...content.blocks[1], correct_option_id: blockIds.unknown }] }
		],
		[
			'duplicate options',
			{
				...content,
				blocks: [
					{
						...content.blocks[1],
						options: [content.blocks[1].options[0], content.blocks[1].options[0]]
					}
				]
			}
		],
		[
			'one option',
			{ ...content, blocks: [{ ...content.blocks[1], options: [content.blocks[1].options[0]] }] }
		],
		[
			'too many options',
			{
				...content,
				blocks: [
					{
						...content.blocks[1],
						options: Array.from({ length: 5 }, (_, i) => ({
							id: `66000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
							label: String(i)
						}))
					}
				]
			}
		],
		[
			'long option label',
			{
				...content,
				blocks: [
					{
						...content.blocks[1],
						options: [
							{ ...content.blocks[1].options[0], label: 'x'.repeat(401) },
							content.blocks[1].options[1]
						]
					}
				]
			}
		],
		[
			'answer leakage in public option',
			{
				...content,
				blocks: [
					{
						...content.blocks[1],
						options: [
							{ ...content.blocks[1].options[0], correct: true },
							content.blocks[1].options[1]
						]
					}
				]
			}
		],
		[
			'child free-text payload',
			{ ...content, blocks: [{ ...content.blocks[2], answer: 'Child private text' }] }
		],
		['empty reflection', { ...content, blocks: [{ ...content.blocks[2], prompt: ' ' }] }],
		['long prompt', { ...content, blocks: [{ ...content.blocks[2], prompt: 'x'.repeat(1201) }] }]
	];
	await test('malformed/oversized block payloads are rejected without partial content or key changes', async () => {
		for (const [name, payload] of invalidPayloads) {
			await assert.rejects(
				() => save(ids.teacher, lesson, payload),
				(error) => error.code === '22023',
				name
			);
		}
		assert.equal(
			await scalar('select content_version from public.lessons where id=$1', [lesson]),
			1
		);
		assert.deepEqual(
			await asUser(ids.teacher, () =>
				scalar('select public.get_lesson_blocks_for_editor($1)', [lesson])
			),
			content.blocks
		);
		assert.equal(await scalar('select count(*)::int from public.lessons'), 2);
	});

	const editingLesson = await save(ids.teacher, null, { ...content, status: 'draft' });
	await test('editor snapshots and exact edit tokens prevent stale or tokenless saves', async () => {
		const first = await snapshot(ids.teacher, editingLesson);
		await save(
			ids.admin,
			editingLesson,
			{ ...content, status: 'draft', title: 'Reviewed title' },
			first.lesson.updated_at
		);
		const current = await snapshot(ids.teacher, editingLesson);
		assert.equal(current.lesson.title, 'Reviewed title');
		assert.equal(current.lesson.content_version, first.lesson.content_version);
		assert.notEqual(current.lesson.updated_at, first.lesson.updated_at);
		await denied(
			() => save(ids.teacher, editingLesson, content, first.lesson.updated_at),
			'22023',
			'lesson_conflict'
		);
		await denied(() => save(ids.teacher, editingLesson, content, null), '22023', 'lesson_conflict');
		await denied(
			() =>
				asUser(ids.teacher, () =>
					rows('select public.save_lesson($1,$2)', [editingLesson, JSON.stringify(content)])
				),
			'22023',
			'lesson_conflict'
		);
		assert.equal((await snapshot(ids.teacher, editingLesson)).lesson.title, 'Reviewed title');
		assert.deepEqual(current.author_blocks, content.blocks);
		await asUser(ids.teacher, () =>
			rows("update public.lessons set status='published' where id=$1", [editingLesson])
		);
		await denied(
			() => save(ids.teacher, editingLesson, content, current.lesson.updated_at),
			'22023',
			'lesson_conflict'
		);
		assert.equal((await snapshot(ids.teacher, editingLesson)).lesson.content_version, 1);
	});

	await test('same-transaction saves advance the edit token and reject reuse of the original token', async () => {
		await asUser(ids.teacher, async () => {
			const first = await scalar('select public.get_lesson_editor_snapshot($1)', [editingLesson]);
			await rows('select public.save_lesson($1,$2,$3)', [
				editingLesson,
				JSON.stringify(content),
				first.lesson.updated_at
			]);
			const second = await scalar('select public.get_lesson_editor_snapshot($1)', [editingLesson]);
			assert.notEqual(second.lesson.updated_at, first.lesson.updated_at);
			assert.equal(second.lesson.content_version, first.lesson.content_version);
			await db.exec('savepoint stale_editor');
			await assert.rejects(
				() =>
					rows('select public.save_lesson($1,$2,$3)', [
						editingLesson,
						JSON.stringify(content),
						first.lesson.updated_at
					]),
				(error) => error.code === '22023' && error.message === 'lesson_conflict'
			);
			await db.exec('rollback to savepoint stale_editor');
			await rows('select public.save_lesson($1,$2,$3)', [
				editingLesson,
				JSON.stringify(content),
				second.lesson.updated_at
			]);
			const third = await scalar('select public.get_lesson_editor_snapshot($1)', [editingLesson]);
			assert.notEqual(third.lesson.updated_at, second.lesson.updated_at);
			assert.deepEqual(third.author_blocks, content.blocks);
			assert.equal(third.lesson.content_version, first.lesson.content_version);
		});
	});

	await test('published lesson submission requires family ownership, age and content language', async () => {
		await denied(() => submit(ids.other, child, lesson, blockIds.reading));
		await denied(() => submit(ids.teacher, child, lesson, blockIds.reading));
		await denied(() => submit(ids.parent, otherChild, lesson, blockIds.reading));
		await denied(() => submit(ids.parent, youngChild, lesson, blockIds.reading), '22023');
		await denied(() => submit(ids.parent, russianChild, lesson, blockIds.reading), '22023');
		await denied(() => submit(ids.parent, child, lesson, blockIds.unknown), '22023');
		await denied(
			() => submit(ids.parent, child, lesson, blockIds.reading, null),
			'22023',
			'lesson_changed'
		);
	});

	await test('direct staff publish/unpublish remains authorized and unavailable lessons cannot be completed', async () => {
		await asUser(ids.teacher, () =>
			rows("update public.lessons set status='draft' where id=$1", [lesson])
		);
		assert.equal(
			(await asUser(ids.parent, () => rows('select id from public.lessons where id=$1', [lesson])))
				.length,
			0
		);
		await denied(() => submit(ids.parent, child, lesson, blockIds.reading), '22023');
		await denied(() => complete(ids.parent, child, lesson), '22023');
		assert.equal(
			(
				await asUser(ids.teacher2, () =>
					rows("update public.lessons set status='published' where id=$1 returning id", [lesson])
				)
			).length,
			0
		);
		await asUser(ids.teacher, () =>
			rows("update public.lessons set status='published' where id=$1", [lesson])
		);
		assert.equal(
			await scalar('select content_version from public.lessons where id=$1', [lesson]),
			1
		);
	});

	await test('sequence cannot skip unread blocks or finalize an unfinished lesson', async () => {
		await denied(
			() => submit(ids.parent, child, lesson, blockIds.choice, 1, blockIds.correct),
			'22023',
			'previous_steps_required'
		);
		await denied(() => submit(ids.parent, child, lesson, blockIds.reflection), '22023');
		await denied(() => complete(ids.parent, child, lesson), '22023', 'steps_required');
		await denied(
			() => submit(ids.parent, child, lesson, blockIds.reading, 1, blockIds.correct),
			'22023'
		);
		assert.equal(await scalar('select count(*)::int from public.lesson_block_progress'), 0);
	});

	await test('reading confirmation saves a resumable count and retries preserve the first timestamp', async () => {
		const result = await submit(ids.parent, child, lesson, blockIds.reading);
		assert.deepEqual(result, {
			correct: true,
			completed: true,
			completed_count: 1,
			total_blocks: 3
		});
		const first = await scalar(
			'select completed_at from public.lesson_block_progress where child_profile_id=$1 and lesson_id=$2',
			[child, lesson]
		);
		assert.deepEqual(await submit(ids.parent, child, lesson, blockIds.reading), result);
		assert.deepEqual(
			await scalar(
				'select completed_at from public.lesson_block_progress where child_profile_id=$1 and lesson_id=$2',
				[child, lesson]
			),
			first
		);
		const progress = (
			await asUser(ids.parent, () =>
				rows('select * from public.lesson_progress where child_profile_id=$1 and lesson_id=$2', [
					child,
					lesson
				])
			)
		)[0];
		assert.equal(progress.status, 'in_progress');
		assert.equal(progress.last_step, 1);
		assert.equal(progress.content_version, 1);
		assert.equal(progress.completed_at, null);
	});

	await test('wrong choice neither completes the block nor unlocks later work; retries are allowed', async () => {
		assert.deepEqual(
			await submit(ids.parent, child, lesson, blockIds.choice, 1, blockIds.incorrect),
			{
				correct: false,
				completed: false,
				completed_count: 1,
				total_blocks: 3
			}
		);
		await denied(
			() => submit(ids.parent, child, lesson, blockIds.choice, 1, blockIds.unknown),
			'22023'
		);
		await denied(() => submit(ids.parent, child, lesson, blockIds.choice, 1), '22023');
		await denied(() => submit(ids.parent, child, lesson, blockIds.reflection), '22023');
		assert.equal(
			await scalar('select count(*)::int from public.lesson_block_progress where lesson_id=$1', [
				lesson
			]),
			1
		);
		assert.equal(
			await scalar('select count(*)::int from public.hero_rewards where lesson_id=$1', [lesson]),
			0
		);
		assert.deepEqual(
			await submit(ids.parent, child, lesson, blockIds.choice, 1, blockIds.correct),
			{
				correct: true,
				completed: true,
				completed_count: 2,
				total_blocks: 3
			}
		);
	});

	await test('reflection stores only confirmation and completion awards exactly 25 XP once', async () => {
		await denied(
			() => submit(ids.parent, child, lesson, blockIds.reflection, 1, blockIds.correct),
			'22023'
		);
		const reflected = await submit(ids.parent, child, lesson, blockIds.reflection);
		assert.equal(reflected.completed_count, 3);
		assert.equal(
			await scalar('select count(*)::int from public.hero_rewards where lesson_id=$1', [lesson]),
			0
		);
		const progress = await complete(ids.parent, child, lesson);
		assert.equal(progress.status, 'completed');
		assert.equal(progress.last_step, 3);
		const firstReward = (
			await rows('select * from public.hero_rewards where lesson_id=$1 and child_profile_id=$2', [
				lesson,
				child
			])
		)[0];
		for (let i = 0; i < 3; i++)
			assert.equal((await complete(ids.parent, child, lesson)).completed_at, progress.completed_at);
		await submit(ids.parent, child, lesson, blockIds.reading);
		assert.equal(
			await scalar(
				'select status from public.lesson_progress where lesson_id=$1 and child_profile_id=$2',
				[lesson, child]
			),
			'completed'
		);
		assert.deepEqual(
			(
				await rows('select * from public.hero_rewards where lesson_id=$1 and child_profile_id=$2', [
					lesson,
					child
				])
			)[0],
			firstReward
		);
		assert.equal(firstReward.xp, 25);
		assert.equal(firstReward.location, 'observatory');
		const columnNames = (
			await rows(
				"select column_name from information_schema.columns where table_schema='public' and table_name='lesson_block_progress'"
			)
		).map((row) => row.column_name);
		assert.deepEqual(
			columnNames.sort(),
			['child_profile_id', 'lesson_id', 'block_id', 'content_version', 'completed_at'].sort()
		);
	});

	await test('other families and staff cannot read progress or earned rewards', async () => {
		for (const user of [ids.other, ids.teacher, ids.root]) {
			for (const table of ['lesson_progress', 'lesson_block_progress', 'hero_rewards']) {
				assert.equal((await asUser(user, () => rows(`select * from public.${table}`))).length, 0);
			}
		}
		await denied(() => asRole('anon', null, () => rows('select * from public.hero_rewards')));
		assert.equal(
			(
				await asUser(ids.parent, () =>
					rows('select * from public.lesson_block_progress where lesson_id=$1', [lesson])
				)
			).length,
			3
		);
	});

	await test('same content and metadata-only edits preserve the learning revision and progress', async () => {
		await save(ids.teacher, lesson);
		await save(ids.admin, lesson, {
			...content,
			title: 'A clearer title',
			description: 'A new introduction.',
			location: 'workshop'
		});
		assert.equal(
			await scalar('select content_version from public.lessons where id=$1', [lesson]),
			1
		);
		assert.equal((await complete(ids.parent, child, lesson)).content_version, 1);
		assert.equal(
			await scalar(
				'select location from public.hero_rewards where child_profile_id=$1 and lesson_id=$2',
				[child, lesson]
			),
			'observatory'
		);
	});

	const revised = structuredClone(content);
	revised.blocks[1].correct_option_id = blockIds.incorrect;
	await test('private answer changes invalidate old progress even when public blocks are identical', async () => {
		await save(ids.teacher, lesson, revised);
		assert.equal(
			await scalar('select content_version from public.lessons where id=$1', [lesson]),
			2
		);
		await denied(
			() => submit(ids.parent, child, lesson, blockIds.reading, 1),
			'22023',
			'lesson_changed'
		);
		await denied(() => complete(ids.parent, child, lesson, 1), '22023', 'lesson_changed');
		await denied(() => complete(ids.parent, child, lesson, 2), '22023');
		await denied(
			() => submit(ids.parent, child, lesson, blockIds.choice, 2, blockIds.incorrect),
			'22023'
		);
		assert.equal(
			await scalar(
				'select content_version from public.lesson_progress where child_profile_id=$1 and lesson_id=$2',
				[child, lesson]
			),
			1
		);
		await submit(ids.parent, child, lesson, blockIds.reading, 2);
		const progress = (
			await rows(
				'select * from public.lesson_progress where child_profile_id=$1 and lesson_id=$2',
				[child, lesson]
			)
		)[0];
		assert.equal(progress.content_version, 2);
		assert.equal(progress.status, 'in_progress');
		assert.equal(progress.completed_at, null);
		assert.equal(progress.last_step, 1);
		assert.equal(
			(await submit(ids.parent, child, lesson, blockIds.choice, 2, blockIds.correct)).correct,
			false
		);
	});

	await test('relearning a changed revision never farms a second reward or resets earned time', async () => {
		const firstReward = (
			await rows('select * from public.hero_rewards where child_profile_id=$1 and lesson_id=$2', [
				child,
				lesson
			])
		)[0];
		await submit(ids.parent, child, lesson, blockIds.choice, 2, blockIds.incorrect);
		await submit(ids.parent, child, lesson, blockIds.reflection, 2);
		const progress = await complete(ids.parent, child, lesson, 2);
		assert.equal(progress.content_version, 2);
		assert.equal(progress.status, 'completed');
		assert.deepEqual(
			(
				await rows('select * from public.hero_rewards where child_profile_id=$1 and lesson_id=$2', [
					child,
					lesson
				])
			)[0],
			firstReward
		);
		assert.equal(
			await scalar(
				'select sum(xp)::int from public.hero_rewards where child_profile_id=$1 and lesson_id=$2',
				[child, lesson]
			),
			25
		);
	});

	await test('body, public blocks, age, language and order changes increment the revision', async () => {
		let next = structuredClone(revised);
		let version = 2;
		for (const mutate of [
			(value) => {
				value.body = 'A changed overview for this lesson.';
			},
			(value) => {
				value.blocks[0].body = 'A changed reading instruction.';
			},
			(value) => {
				value.age_band = '10-12';
			},
			(value) => {
				value.locale = 'ru';
			},
			(value) => {
				value.blocks.reverse();
			}
		]) {
			next = structuredClone(next);
			mutate(next);
			await save(ids.teacher, lesson, next);
			version++;
			assert.equal(
				await scalar('select content_version from public.lessons where id=$1', [lesson]),
				version
			);
		}
		await denied(() => submit(ids.parent, child, lesson, blockIds.reading, version), '22023');
	});

	await test('a second hero gets independent progress and one personal reward', async () => {
		const second = await save(ids.teacher, null, { ...content, blocks: [content.blocks[0]] });
		await submit(ids.parent, sibling, second, blockIds.reading);
		await complete(ids.parent, sibling, second);
		assert.equal(
			await scalar(
				'select count(*)::int from public.hero_rewards where child_profile_id=$1 and lesson_id=$2',
				[sibling, second]
			),
			1
		);
		assert.equal(
			await scalar(
				'select count(*)::int from public.hero_rewards where child_profile_id=$1 and lesson_id=$2',
				[child, second]
			),
			0
		);
	});

	await test('deleting a lesson removes answer keys and progress but retains the earned reward', async () => {
		const reward = (
			await rows('select * from public.hero_rewards where child_profile_id=$1 and lesson_id=$2', [
				child,
				lesson
			])
		)[0];
		assert.equal(
			(
				await asUser(ids.teacher2, () =>
					rows('delete from public.lessons where id=$1 returning id', [lesson])
				)
			).length,
			0
		);
		assert.equal(
			(
				await asUser(ids.teacher, () =>
					rows('delete from public.lessons where id=$1 returning id', [lesson])
				)
			).length,
			1
		);
		assert.equal(
			await scalar('select count(*)::int from private.lesson_answer_keys where lesson_id=$1', [
				lesson
			]),
			0
		);
		assert.equal(
			await scalar('select count(*)::int from public.lesson_block_progress where lesson_id=$1', [
				lesson
			]),
			0
		);
		assert.equal(
			await scalar('select count(*)::int from public.lesson_progress where lesson_id=$1', [lesson]),
			0
		);
		assert.deepEqual(
			(
				await asUser(ids.parent, () =>
					rows('select * from public.hero_rewards where child_profile_id=$1 and lesson_id=$2', [
						child,
						lesson
					])
				)
			)[0],
			reward
		);
		await denied(() => complete(ids.parent, child, lesson, 7), '22023');
	});

	await test('deleting a hero removes that hero rewards and leaves sibling data intact', async () => {
		await asUser(ids.parent, () => rows('delete from public.child_profiles where id=$1', [child]));
		assert.equal(
			await scalar('select count(*)::int from public.hero_rewards where child_profile_id=$1', [
				child
			]),
			0
		);
		assert.equal(
			await scalar('select count(*)::int from public.hero_rewards where child_profile_id=$1', [
				sibling
			]),
			1
		);
	});

	console.log(`\n${passed} learning SQL tests passed.`);
} finally {
	await db.close();
}
