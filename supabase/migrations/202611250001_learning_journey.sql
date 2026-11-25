-- Interactive learning: public blocks, private answer keys, revision-bound
-- progress and one-time rewards. Apply after 202611240001_foundation.sql.

alter table public.lessons
  add column blocks jsonb not null default '[]'::jsonb,
  add column content_version integer not null default 1 check (content_version > 0),
  add constraint lessons_blocks_array check (jsonb_typeof(blocks) = 'array' and jsonb_array_length(blocks) <= 12);

alter table public.lesson_progress
  add column content_version integer not null default 1 check (content_version > 0);

-- Unlike transaction-scoped now(), this edit token advances for every update,
-- including two saves or a publish action inside the same transaction.
create function private.advance_lesson_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
  return new;
end;
$$;
drop trigger lessons_updated on public.lessons;
create trigger lessons_updated before update on public.lessons
for each row execute function private.advance_lesson_updated_at();
revoke execute on function private.advance_lesson_updated_at()
  from public, anon, authenticated, service_role;

create table private.lesson_answer_keys (
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  block_id uuid not null,
  correct_option_id uuid not null,
  primary key (lesson_id, block_id)
);
alter table private.lesson_answer_keys enable row level security;

create table public.lesson_block_progress (
  child_profile_id uuid not null references public.child_profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  block_id uuid not null,
  content_version integer not null check (content_version > 0),
  completed_at timestamptz not null default now(),
  primary key (child_profile_id, lesson_id, content_version, block_id)
);
alter table public.lesson_block_progress enable row level security;
create policy block_progress_read_owner on public.lesson_block_progress
for select to authenticated using (private.owns_child(child_profile_id));

create table public.hero_rewards (
  child_profile_id uuid not null references public.child_profiles(id) on delete cascade,
  -- Deliberately no lesson FK: deleting curriculum must not erase earned XP.
  lesson_id uuid not null,
  location text not null check (location in ('school', 'observatory', 'workshop', 'library', 'garden', 'tree')),
  xp integer not null default 25 check (xp = 25),
  earned_at timestamptz not null default now(),
  primary key (child_profile_id, lesson_id)
);
create index hero_rewards_child_location_idx on public.hero_rewards(child_profile_id, location);
alter table public.hero_rewards enable row level security;
create policy hero_rewards_read_owner on public.hero_rewards
for select to authenticated using (private.owns_child(child_profile_id));

-- Preserve previously acknowledged lessons and their original completion time.
insert into public.hero_rewards (child_profile_id, lesson_id, location, earned_at)
select p.child_profile_id, p.lesson_id, l.location, p.completed_at
from public.lesson_progress p join public.lessons l on l.id = p.lesson_id
where p.status = 'completed'
on conflict (child_profile_id, lesson_id) do nothing;

create function public.save_lesson(
  p_lesson_id uuid, p_content jsonb, p_expected_updated_at timestamptz default null
)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_previous public.lessons;
  v_version integer := 1;
  v_title text;
  v_blocks jsonb := '[]'::jsonb;
  v_keys jsonb := '{}'::jsonb;
  v_old_keys jsonb;
  v_block jsonb;
  v_option jsonb;
  v_options jsonb;
  v_block_id uuid;
  v_option_id uuid;
  v_correct_id uuid;
  v_seen_blocks uuid[] := '{}'::uuid[];
  v_seen_options uuid[];
  v_uuid_pattern constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'Staff access required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_content) is distinct from 'object' then
    raise exception 'Invalid lesson content' using errcode = '22023';
  end if;
  if octet_length(p_content::text) > 524288
    or not (p_content ?& array['title', 'description', 'body', 'locale', 'age_band', 'location', 'status', 'blocks'])
    or exists (select 1 from jsonb_object_keys(p_content) k
      where k not in ('title', 'description', 'body', 'locale', 'age_band', 'location', 'status', 'blocks')) then
    raise exception 'Invalid lesson content' using errcode = '22023';
  end if;
  if jsonb_typeof(p_content -> 'title') is distinct from 'string'
    or jsonb_typeof(p_content -> 'description') is distinct from 'string'
    or jsonb_typeof(p_content -> 'body') is distinct from 'string'
    or jsonb_typeof(p_content -> 'locale') is distinct from 'string'
    or jsonb_typeof(p_content -> 'age_band') is distinct from 'string'
    or jsonb_typeof(p_content -> 'location') is distinct from 'string'
    or jsonb_typeof(p_content -> 'status') is distinct from 'string'
    or jsonb_typeof(p_content -> 'blocks') is distinct from 'array' then
    raise exception 'Invalid lesson content' using errcode = '22023';
  end if;
  v_title := btrim(p_content ->> 'title');
  if char_length(v_title) not between 3 and 120
    or char_length(p_content ->> 'description') > 400
    or char_length(p_content ->> 'body') > 20000
    or p_content ->> 'locale' not in ('lv', 'ru', 'en')
    or p_content ->> 'age_band' not in ('4-6', '7-9', '10-12')
    or p_content ->> 'location' not in ('school', 'observatory', 'workshop', 'library', 'garden', 'tree')
    or p_content ->> 'status' not in ('draft', 'published')
    or jsonb_array_length(p_content -> 'blocks') > 12
    or (jsonb_array_length(p_content -> 'blocks') = 0 and char_length(btrim(p_content ->> 'body')) < 10) then
    raise exception 'Invalid lesson content' using errcode = '22023';
  end if;

  for v_block in select value from jsonb_array_elements(p_content -> 'blocks') loop
    if jsonb_typeof(v_block) is distinct from 'object' then
      raise exception 'Invalid lesson block' using errcode = '22023';
    end if;
    if jsonb_typeof(v_block -> 'id') is distinct from 'string'
      or coalesce(v_block ->> 'id', '') !~* v_uuid_pattern
      or jsonb_typeof(v_block -> 'type') is distinct from 'string'
      or v_block ->> 'type' not in ('reading', 'choice', 'reflection') then
      raise exception 'Invalid lesson block' using errcode = '22023';
    end if;
    v_block_id := (v_block ->> 'id')::uuid;
    if v_block_id = any(v_seen_blocks) then
      raise exception 'Duplicate lesson block' using errcode = '22023';
    end if;
    v_seen_blocks := array_append(v_seen_blocks, v_block_id);

    if v_block ->> 'type' = 'reading' then
      if jsonb_typeof(v_block -> 'title') is distinct from 'string'
        or jsonb_typeof(v_block -> 'body') is distinct from 'string'
        or char_length(btrim(v_block ->> 'title')) not between 1 and 160
        or char_length(btrim(v_block ->> 'body')) not between 1 and 6000
        or char_length(v_block ->> 'body') > 6000
        or exists (select 1 from jsonb_object_keys(v_block) k where k not in ('id', 'type', 'title', 'body')) then
        raise exception 'Invalid reading block' using errcode = '22023';
      end if;
      v_blocks := v_blocks || jsonb_build_array(jsonb_build_object(
        'id', v_block_id, 'type', 'reading', 'title', btrim(v_block ->> 'title'), 'body', v_block ->> 'body'));
    elsif v_block ->> 'type' = 'reflection' then
      if jsonb_typeof(v_block -> 'prompt') is distinct from 'string'
        or char_length(btrim(v_block ->> 'prompt')) not between 1 and 1200
        or exists (select 1 from jsonb_object_keys(v_block) k where k not in ('id', 'type', 'prompt')) then
        raise exception 'Invalid reflection block' using errcode = '22023';
      end if;
      v_blocks := v_blocks || jsonb_build_array(jsonb_build_object(
        'id', v_block_id, 'type', 'reflection', 'prompt', btrim(v_block ->> 'prompt')));
    else
      if jsonb_typeof(v_block -> 'prompt') is distinct from 'string'
        or char_length(btrim(v_block ->> 'prompt')) not between 1 and 1200
        or jsonb_typeof(v_block -> 'correct_option_id') is distinct from 'string'
        or coalesce(v_block ->> 'correct_option_id', '') !~* v_uuid_pattern
        or jsonb_typeof(v_block -> 'options') is distinct from 'array'
        or exists (select 1 from jsonb_object_keys(v_block) k
          where k not in ('id', 'type', 'prompt', 'options', 'correct_option_id')) then
        raise exception 'Invalid choice block' using errcode = '22023';
      end if;
      if jsonb_array_length(v_block -> 'options') not between 2 and 4 then
        raise exception 'Invalid choice options' using errcode = '22023';
      end if;
      v_correct_id := (v_block ->> 'correct_option_id')::uuid;
      v_seen_options := '{}'::uuid[];
      v_options := '[]'::jsonb;
      for v_option in select value from jsonb_array_elements(v_block -> 'options') loop
        if jsonb_typeof(v_option) is distinct from 'object' then
          raise exception 'Invalid choice option' using errcode = '22023';
        end if;
        if jsonb_typeof(v_option -> 'id') is distinct from 'string'
          or coalesce(v_option ->> 'id', '') !~* v_uuid_pattern
          or jsonb_typeof(v_option -> 'label') is distinct from 'string'
          or char_length(btrim(v_option ->> 'label')) not between 1 and 400
          or exists (select 1 from jsonb_object_keys(v_option) k where k not in ('id', 'label')) then
          raise exception 'Invalid choice option' using errcode = '22023';
        end if;
        v_option_id := (v_option ->> 'id')::uuid;
        if v_option_id = any(v_seen_options) then
          raise exception 'Duplicate choice option' using errcode = '22023';
        end if;
        v_seen_options := array_append(v_seen_options, v_option_id);
        v_options := v_options || jsonb_build_array(jsonb_build_object(
          'id', v_option_id, 'label', btrim(v_option ->> 'label')));
      end loop;
      if not (v_correct_id = any(v_seen_options)) then
        raise exception 'Choice answer must match an option' using errcode = '22023';
      end if;
      v_keys := v_keys || jsonb_build_object(v_block_id::text, v_correct_id::text);
      v_blocks := v_blocks || jsonb_build_array(jsonb_build_object(
        'id', v_block_id, 'type', 'choice', 'prompt', btrim(v_block ->> 'prompt'), 'options', v_options));
    end if;
  end loop;

  if p_lesson_id is null then
    insert into public.lessons (author_id, title, description, body, locale, age_band, location, status, blocks)
    values (auth.uid(), v_title, p_content ->> 'description', p_content ->> 'body',
      p_content ->> 'locale', p_content ->> 'age_band', p_content ->> 'location', p_content ->> 'status', v_blocks)
    returning id into v_id;
  else
    select * into v_previous from public.lessons where id = p_lesson_id for update;
    if not found or not public.is_staff()
      or (v_previous.author_id <> auth.uid() and public.current_app_role() not in ('admin', 'root_admin')) then
      raise exception 'Lesson editing is not allowed' using errcode = '42501';
    end if;
    if p_expected_updated_at is distinct from v_previous.updated_at then
      raise exception 'lesson_conflict' using errcode = '22023';
    end if;
    v_id := v_previous.id;
    select coalesce(jsonb_object_agg(block_id::text, correct_option_id::text), '{}'::jsonb)
      into v_old_keys from private.lesson_answer_keys where lesson_id = v_id;
    v_version := v_previous.content_version;
    if v_previous.body is distinct from p_content ->> 'body'
      or v_previous.locale is distinct from p_content ->> 'locale'
      or v_previous.age_band is distinct from p_content ->> 'age_band'
      or v_previous.blocks is distinct from v_blocks
      or v_old_keys is distinct from v_keys then
      v_version := v_version + 1;
    end if;
    update public.lessons set title = v_title, description = p_content ->> 'description',
      body = p_content ->> 'body', locale = p_content ->> 'locale', age_band = p_content ->> 'age_band',
      location = p_content ->> 'location', status = p_content ->> 'status', blocks = v_blocks,
      content_version = v_version where id = v_id;
  end if;

  delete from private.lesson_answer_keys where lesson_id = v_id;
  insert into private.lesson_answer_keys (lesson_id, block_id, correct_option_id)
  select v_id, key::uuid, value::uuid from jsonb_each_text(v_keys);
  return v_id;
end;
$$;

create function public.get_lesson_blocks_for_editor(p_lesson_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_lesson public.lessons;
  v_blocks jsonb;
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'Staff access required' using errcode = '42501';
  end if;
  select * into v_lesson from public.lessons where id = p_lesson_id;
  if not found or (v_lesson.author_id <> auth.uid() and public.current_app_role() not in ('admin', 'root_admin')) then
    raise exception 'Lesson editing is not allowed' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(
    case when block.value ->> 'type' = 'choice'
      then block.value || jsonb_build_object('correct_option_id', keys.correct_option_id)
      else block.value end order by block.ordinality), '[]'::jsonb)
    into v_blocks
  from jsonb_array_elements(v_lesson.blocks) with ordinality as block(value, ordinality)
  left join private.lesson_answer_keys keys on keys.lesson_id = v_lesson.id
    and keys.block_id = (block.value ->> 'id')::uuid;
  return v_blocks;
end;
$$;

create function public.get_lesson_editor_snapshot(p_lesson_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_lesson public.lessons;
  v_blocks jsonb;
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'Staff access required' using errcode = '42501';
  end if;
  -- This protects the metadata and private answer-key reads as one snapshot.
  -- All content saves lock the lesson row before replacing its private keys.
  select * into v_lesson from public.lessons where id = p_lesson_id for share;
  if not found or (v_lesson.author_id <> auth.uid() and public.current_app_role() not in ('admin', 'root_admin')) then
    raise exception 'Lesson editing is not allowed' using errcode = '42501';
  end if;
  v_blocks := public.get_lesson_blocks_for_editor(p_lesson_id);
  return jsonb_build_object('lesson', to_jsonb(v_lesson), 'author_blocks', v_blocks);
end;
$$;

create function public.submit_lesson_block(
  p_child_profile_id uuid,
  p_lesson_id uuid,
  p_block_id uuid,
  p_content_version integer,
  p_option_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_lesson public.lessons;
  v_block jsonb;
  v_ordinality bigint;
  v_correct boolean;
  v_already_completed boolean;
  v_count integer;
  v_total integer;
begin
  if not private.owns_child(p_child_profile_id) then
    raise exception 'Child profile not found' using errcode = '42501';
  end if;
  -- Share lock keeps publication, blocks and answer keys consistent until commit.
  select * into v_lesson from public.lessons where id = p_lesson_id for share;
  if not found or v_lesson.status <> 'published' or not exists (
    select 1 from public.child_profiles c where c.id = p_child_profile_id
      and c.age_band = v_lesson.age_band and c.locale = v_lesson.locale
  ) then
    raise exception 'Lesson is not available for this hero' using errcode = '22023';
  end if;
  if p_content_version is null or p_content_version <> v_lesson.content_version then
    raise exception 'lesson_changed' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('laimigi.learning.' || p_child_profile_id::text || '.' || p_lesson_id::text, 0));
  select value, ordinality into v_block, v_ordinality
    from jsonb_array_elements(v_lesson.blocks) with ordinality
    where value ->> 'id' = p_block_id::text;
  if not found then
    raise exception 'Lesson block not found' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_lesson.blocks) with ordinality as earlier(value, ordinality)
    where earlier.ordinality < v_ordinality and not exists (
      select 1 from public.lesson_block_progress p
      where p.child_profile_id = p_child_profile_id and p.lesson_id = p_lesson_id
        and p.content_version = v_lesson.content_version and p.block_id = (earlier.value ->> 'id')::uuid
    )
  ) then
    raise exception 'previous_steps_required' using errcode = '22023';
  end if;

  if v_block ->> 'type' = 'choice' then
    if p_option_id is null or not exists (
      select 1 from jsonb_array_elements(v_block -> 'options') opt
      where opt ->> 'id' = p_option_id::text
    ) then
      raise exception 'Invalid choice option' using errcode = '22023';
    end if;
    select correct_option_id = p_option_id into v_correct from private.lesson_answer_keys
      where lesson_id = p_lesson_id and block_id = p_block_id;
    if not found then
      raise exception 'Lesson answer is unavailable' using errcode = '22023';
    end if;
  else
    if p_option_id is not null then
      raise exception 'This block does not accept an option' using errcode = '22023';
    end if;
    v_correct := true;
  end if;
  if v_correct then
    insert into public.lesson_block_progress (child_profile_id, lesson_id, block_id, content_version)
    values (p_child_profile_id, p_lesson_id, p_block_id, v_lesson.content_version)
    on conflict (child_profile_id, lesson_id, content_version, block_id) do nothing;
  end if;
  select count(*)::integer into v_count from public.lesson_block_progress
    where child_profile_id = p_child_profile_id and lesson_id = p_lesson_id
      and content_version = v_lesson.content_version;
  v_total := jsonb_array_length(v_lesson.blocks);
  select exists (select 1 from public.lesson_block_progress
    where child_profile_id = p_child_profile_id and lesson_id = p_lesson_id
      and content_version = v_lesson.content_version and block_id = p_block_id) into v_already_completed;

  insert into public.lesson_progress (child_profile_id, lesson_id, status, last_step, content_version)
  values (p_child_profile_id, p_lesson_id, 'in_progress', v_count, v_lesson.content_version)
  on conflict (child_profile_id, lesson_id) do update set
    last_step = excluded.last_step,
    content_version = excluded.content_version,
    status = case when public.lesson_progress.content_version = excluded.content_version
      then public.lesson_progress.status else 'in_progress' end,
    completed_at = case when public.lesson_progress.content_version = excluded.content_version
      then public.lesson_progress.completed_at else null end;
  return jsonb_build_object('correct', v_correct, 'completed', v_already_completed,
    'completed_count', v_count, 'total_blocks', v_total);
end;
$$;

-- Internal completion implementation. Browser callers use the revision-bound
-- wrapper below; retaining the signature avoids breaking dependencies.
create or replace function public.complete_lesson(p_child_profile_id uuid, p_lesson_id uuid)
returns public.lesson_progress
language plpgsql security definer set search_path = '' as $$
declare
  v_lesson public.lessons;
  v_progress public.lesson_progress;
  v_count integer;
begin
  if not private.owns_child(p_child_profile_id) then
    raise exception 'Child profile not found' using errcode = '42501';
  end if;
  select * into v_lesson from public.lessons where id = p_lesson_id for share;
  if not found or v_lesson.status <> 'published' or not exists (
    select 1 from public.child_profiles c where c.id = p_child_profile_id
      and c.age_band = v_lesson.age_band and c.locale = v_lesson.locale
  ) then
    raise exception 'Lesson is not available for this hero' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('laimigi.learning.' || p_child_profile_id::text || '.' || p_lesson_id::text, 0));
  select count(*)::integer into v_count from public.lesson_block_progress
    where child_profile_id = p_child_profile_id and lesson_id = p_lesson_id
      and content_version = v_lesson.content_version;
  if v_count <> jsonb_array_length(v_lesson.blocks) then
    raise exception 'steps_required' using errcode = '22023';
  end if;
  insert into public.lesson_progress (child_profile_id, lesson_id, status, last_step, content_version, completed_at)
  values (p_child_profile_id, p_lesson_id, 'completed', v_count, v_lesson.content_version, now())
  on conflict (child_profile_id, lesson_id) do update set status = 'completed', last_step = excluded.last_step,
    content_version = excluded.content_version,
    completed_at = case when public.lesson_progress.content_version = excluded.content_version
      then coalesce(public.lesson_progress.completed_at, excluded.completed_at) else excluded.completed_at end
  returning * into v_progress;
  insert into public.hero_rewards (child_profile_id, lesson_id, location)
  values (p_child_profile_id, p_lesson_id, v_lesson.location)
  on conflict (child_profile_id, lesson_id) do nothing;
  return v_progress;
end;
$$;

create function public.complete_lesson_revision(
  p_child_profile_id uuid, p_lesson_id uuid, p_content_version integer
) returns public.lesson_progress
language plpgsql security definer set search_path = '' as $$
declare
  v_version integer;
begin
  if not private.owns_child(p_child_profile_id) then
    raise exception 'Child profile not found' using errcode = '42501';
  end if;
  select content_version into v_version from public.lessons where id = p_lesson_id for share;
  if not found then
    raise exception 'Lesson is not available for this hero' using errcode = '22023';
  end if;
  if p_content_version is null or p_content_version <> v_version then
    raise exception 'lesson_changed' using errcode = '22023';
  end if;
  return public.complete_lesson(p_child_profile_id, p_lesson_id);
end;
$$;

-- Curriculum content and its answer keys must be changed atomically. Staff may
-- still publish/unpublish or delete their authorized rows directly under RLS.
revoke insert on public.lessons from authenticated;
revoke update (body, locale, age_band) on public.lessons from authenticated;
revoke all on public.lesson_block_progress, public.hero_rewards
  from public, anon, authenticated, service_role;
grant select on public.lesson_block_progress, public.hero_rewards to authenticated;
revoke all on private.lesson_answer_keys from public, anon, authenticated, service_role;

revoke execute on function public.save_lesson(uuid, jsonb, timestamptz), public.get_lesson_blocks_for_editor(uuid),
  public.get_lesson_editor_snapshot(uuid),
  public.submit_lesson_block(uuid, uuid, uuid, integer, uuid), public.complete_lesson(uuid, uuid),
  public.complete_lesson_revision(uuid, uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.save_lesson(uuid, jsonb, timestamptz), public.get_lesson_blocks_for_editor(uuid),
  public.get_lesson_editor_snapshot(uuid),
  public.submit_lesson_block(uuid, uuid, uuid, integer, uuid), public.complete_lesson_revision(uuid, uuid, integer)
  to authenticated;

comment on column public.lessons.blocks is 'Sanitized public learning blocks. Choice answer keys exist only in private.lesson_answer_keys.';
comment on table public.lesson_block_progress is 'Current/historical revision confirmations only. No child free-text answers or incorrect choices are stored.';
comment on table public.hero_rewards is 'One immutable 25 XP reward per hero and lesson lifetime, retained when a lesson is deleted.';
