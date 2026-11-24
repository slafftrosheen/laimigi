-- Laimīgie bērni: account, curriculum and provider foundation.
-- Apply with the Supabase CLI or the project's SQL editor as a database owner.
-- Ordinary requests use the signed-in user's JWT. Only named service RPCs bypass RLS.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  locale text not null default 'lv' check (locale in ('lv', 'ru', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'parent' check (role in ('parent', 'teacher', 'admin', 'root_admin')),
  updated_at timestamptz not null default now()
);

create table public.families (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null default '' check (char_length(name) <= 100),
  created_at timestamptz not null default now()
);

create table public.child_profiles (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  nickname text not null check (char_length(btrim(nickname)) between 2 and 32),
  age_band text not null check (age_band in ('4-6', '7-9', '10-12')),
  avatar text not null default 'leaf' check (avatar in ('leaf', 'compass', 'crystal')),
  locale text not null default 'lv' check (locale in ('lv', 'ru', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index child_profiles_family_idx on public.child_profiles(family_id);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  description text not null default '' check (char_length(description) <= 1200),
  body text not null default '' check (char_length(body) <= 30000),
  locale text not null default 'lv' check (locale in ('lv', 'ru', 'en')),
  location text not null check (location in ('school', 'observatory', 'workshop', 'library', 'garden', 'tree')),
  age_band text not null check (age_band in ('4-6', '7-9', '10-12')),
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lessons_published_idx on public.lessons(status, locale, age_band, location);
create index lessons_author_idx on public.lessons(author_id);

-- A learning bookmark, not an authoritative XP/award counter.
create table public.lesson_progress (
  child_profile_id uuid not null references public.child_profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  last_step integer not null default 0 check (last_step between 0 and 10000),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (child_profile_id, lesson_id),
  check ((status = 'completed') = (completed_at is not null))
);

create table public.ai_provider_settings (
  provider text primary key check (provider in ('openrouter', 'openai')),
  model text not null default '' check (char_length(model) <= 160),
  enabled boolean not null default false,
  max_output_tokens integer not null default 1024 check (max_output_tokens between 64 and 4096),
  daily_request_limit integer not null default 100 check (daily_request_limit between 1 and 10000),
  key_hint text check (key_hint is null or char_length(key_hint) = 4),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  check (not enabled or char_length(btrim(model)) > 0)
);

create table private.ai_provider_secrets (
  provider text primary key references public.ai_provider_settings(provider) on delete cascade,
  ciphertext text not null check (char_length(ciphertext) between 32 and 16384),
  updated_at timestamptz not null default now()
);

create table private.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  subject text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table private.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  provider text not null references public.ai_provider_settings(provider),
  status text not null default 'reserved' check (status in ('reserved', 'succeeded', 'failed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index ai_usage_provider_time_idx on private.ai_usage(provider, created_at);
create index ai_usage_user_time_idx on private.ai_usage(user_id, provider, created_at);

create function private.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_updated before update on public.profiles
for each row execute function private.set_updated_at();
create trigger child_profiles_updated before update on public.child_profiles
for each row execute function private.set_updated_at();
create trigger lessons_updated before update on public.lessons
for each row execute function private.set_updated_at();
create trigger lesson_progress_updated before update on public.lesson_progress
for each row execute function private.set_updated_at();

create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Signup metadata is untrusted. Role and family ownership are assigned here.
  insert into public.profiles (id, display_name, locale)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 80),
    case when new.raw_user_meta_data ->> 'locale' in ('lv', 'ru', 'en')
      then new.raw_user_meta_data ->> 'locale' else 'lv' end
  );
  insert into public.user_roles (user_id, role) values (new.id, 'parent');
  insert into public.families (owner_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function private.handle_new_user();

-- Existing verified/unverified adult accounts also start with the parent role.
insert into public.profiles (id, display_name, locale)
select id, left(coalesce(raw_user_meta_data ->> 'display_name', ''), 80),
  case when raw_user_meta_data ->> 'locale' in ('lv', 'ru', 'en')
    then raw_user_meta_data ->> 'locale' else 'lv' end
from auth.users on conflict (id) do nothing;
insert into public.user_roles (user_id, role)
select id, 'parent' from auth.users on conflict (user_id) do nothing;
insert into public.families (owner_id)
select id from auth.users on conflict (owner_id) do nothing;

create function public.current_app_role() returns text
language sql stable security definer set search_path = '' as $$
  select role from public.user_roles where user_id = (select auth.uid());
$$;

create function public.is_root_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.current_app_role() = 'root_admin', false);
$$;

create function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.current_app_role() in ('teacher', 'admin', 'root_admin'), false);
$$;

create function private.owns_child(p_child_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.child_profiles c
    join public.families f on f.id = c.family_id
    where c.id = p_child_id and f.owner_id = (select auth.uid())
  );
$$;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.families enable row level security;
alter table public.child_profiles enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.ai_provider_settings enable row level security;
alter table private.ai_provider_secrets enable row level security;
alter table private.audit_log enable row level security;
alter table private.ai_usage enable row level security;

create policy profiles_read_self on public.profiles for select to authenticated
using (id = (select auth.uid()));
create policy profiles_update_self on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy roles_read_self_or_root on public.user_roles for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_root_admin()));

create policy families_read_owner on public.families for select to authenticated
using (owner_id = (select auth.uid()));
create policy families_update_owner on public.families for update to authenticated
using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy children_read_owner on public.child_profiles for select to authenticated
using (exists (select 1 from public.families f where f.id = family_id and f.owner_id = (select auth.uid())));
create policy children_insert_owner on public.child_profiles for insert to authenticated
with check (exists (select 1 from public.families f where f.id = family_id and f.owner_id = (select auth.uid())));
create policy children_update_owner on public.child_profiles for update to authenticated
using (exists (select 1 from public.families f where f.id = family_id and f.owner_id = (select auth.uid())))
with check (exists (select 1 from public.families f where f.id = family_id and f.owner_id = (select auth.uid())));
create policy children_delete_owner on public.child_profiles for delete to authenticated
using (exists (select 1 from public.families f where f.id = family_id and f.owner_id = (select auth.uid())));

create policy lessons_read on public.lessons for select to authenticated
using (status = 'published' or (author_id = (select auth.uid()) and (select public.is_staff()))
  or (select public.current_app_role()) in ('admin', 'root_admin'));
create policy lessons_insert_staff on public.lessons for insert to authenticated
with check ((select public.is_staff()) and author_id = (select auth.uid()));
create policy lessons_update_staff on public.lessons for update to authenticated
using ((author_id = (select auth.uid()) and (select public.is_staff()))
  or (select public.current_app_role()) in ('admin', 'root_admin'))
with check ((author_id = (select auth.uid()) and (select public.is_staff()))
  or (select public.current_app_role()) in ('admin', 'root_admin'));
create policy lessons_delete_staff on public.lessons for delete to authenticated
using ((author_id = (select auth.uid()) and (select public.is_staff()))
  or (select public.current_app_role()) in ('admin', 'root_admin'));

create policy progress_read_owner on public.lesson_progress for select to authenticated
using (private.owns_child(child_profile_id));

create policy ai_settings_read_root on public.ai_provider_settings for select to authenticated
using ((select public.is_root_admin()));

create function public.complete_lesson(p_child_profile_id uuid, p_lesson_id uuid)
returns public.lesson_progress
language plpgsql security definer set search_path = '' as $$
declare
  v_progress public.lesson_progress;
begin
  if not private.owns_child(p_child_profile_id) then
    raise exception 'Child profile not found' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.lessons l join public.child_profiles c on c.id = p_child_profile_id
    where l.id = p_lesson_id and l.status = 'published' and l.age_band = c.age_band
  ) then
    raise exception 'Lesson is not available for this hero' using errcode = '22023';
  end if;
  insert into public.lesson_progress (child_profile_id, lesson_id, status, completed_at)
  values (p_child_profile_id, p_lesson_id, 'completed', now())
  on conflict (child_profile_id, lesson_id) do update
    set status = 'completed', completed_at = coalesce(public.lesson_progress.completed_at, excluded.completed_at)
  returning * into v_progress;
  return v_progress;
end;
$$;

create function public.configure_ai_provider(
  p_provider text,
  p_model text,
  p_enabled boolean,
  p_max_output_tokens integer,
  p_daily_request_limit integer,
  p_ciphertext text default null,
  p_key_hint text default null,
  p_remove_key boolean default false
) returns public.ai_provider_settings
language plpgsql security definer set search_path = '' as $$
declare
  v_result public.ai_provider_settings;
begin
  if not public.is_root_admin() then
    raise exception 'Root administrator access required' using errcode = '42501';
  end if;
  if p_provider not in ('openrouter', 'openai') then
    raise exception 'Unsupported AI provider' using errcode = '22023';
  end if;
  if p_remove_key and p_ciphertext is not null then
    raise exception 'Cannot replace and remove a key together' using errcode = '22023';
  end if;
  if p_ciphertext is not null and (p_key_hint is null or char_length(p_key_hint) <> 4) then
    raise exception 'Key hint must contain exactly four characters' using errcode = '22023';
  end if;
  -- The same lock as reservation makes disable/rotation atomic with quota admission.
  perform pg_advisory_xact_lock(hashtextextended('laimigi.ai.' || p_provider, 0));
  perform 1 from public.ai_provider_settings where provider = p_provider for update;
  if not found then
    raise exception 'Provider settings not found' using errcode = '22023';
  end if;
  if p_remove_key then
    delete from private.ai_provider_secrets where provider = p_provider;
  elsif p_ciphertext is not null then
    insert into private.ai_provider_secrets (provider, ciphertext)
    values (p_provider, p_ciphertext)
    on conflict (provider) do update set ciphertext = excluded.ciphertext, updated_at = now();
  end if;
  if p_enabled and not exists (select 1 from private.ai_provider_secrets where provider = p_provider) then
    raise exception 'Save a provider key before enabling it' using errcode = '22023';
  end if;
  update public.ai_provider_settings set
    model = btrim(p_model), enabled = p_enabled,
    max_output_tokens = p_max_output_tokens, daily_request_limit = p_daily_request_limit,
    key_hint = case when p_remove_key then null when p_ciphertext is not null then p_key_hint else key_hint end,
    updated_at = now(), updated_by = auth.uid()
  where provider = p_provider returning * into v_result;
  insert into private.audit_log (actor_id, action, subject, details)
  values (auth.uid(), 'ai_provider.configure', p_provider,
    jsonb_build_object('enabled', p_enabled, 'model', p_model,
      'max_output_tokens', p_max_output_tokens, 'daily_request_limit', p_daily_request_limit,
      'key_action', case when p_remove_key then 'removed' when p_ciphertext is not null then 'replaced' else 'unchanged' end));
  return v_result;
end;
$$;

create function public.get_ai_provider_secret(p_provider text) returns text
language sql security definer set search_path = '' as $$
  select ciphertext from private.ai_provider_secrets where provider = p_provider;
$$;

create function public.reserve_ai_request(p_user_id uuid, p_provider text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_settings public.ai_provider_settings;
  v_request_id uuid;
begin
  if not exists (select 1 from public.user_roles where user_id = p_user_id
    and role in ('teacher', 'admin', 'root_admin')) then
    raise exception 'Staff access required' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('laimigi.ai.' || p_provider, 0));
  select * into v_settings from public.ai_provider_settings where provider = p_provider;
  if not found or not v_settings.enabled then
    raise exception 'AI provider is disabled' using errcode = '22023';
  end if;
  if not exists (select 1 from private.ai_provider_secrets where provider = p_provider) then
    raise exception 'AI provider key is missing' using errcode = '22023';
  end if;
  if (select count(*) from private.ai_usage where provider = p_provider
    and created_at >= date_trunc('day', now(), 'UTC')) >= v_settings.daily_request_limit then
    raise exception 'AI daily request limit reached' using errcode = 'P0001';
  end if;
  if (select count(*) from private.ai_usage where user_id = p_user_id and provider = p_provider
    and created_at > now() - interval '1 minute') >= 5 then
    raise exception 'AI minute request limit reached' using errcode = 'P0001';
  end if;
  insert into private.ai_usage (user_id, provider) values (p_user_id, p_provider)
  returning id into v_request_id;
  return v_request_id;
end;
$$;

create function public.finish_ai_request(p_request_id uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('succeeded', 'failed') then
    raise exception 'Invalid AI request status' using errcode = '22023';
  end if;
  update private.ai_usage set status = p_status, completed_at = now()
  where id = p_request_id and status = 'reserved';
end;
$$;

create function public.set_user_role(p_user_id uuid, p_role text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_previous text;
begin
  perform pg_advisory_xact_lock(hashtextextended('laimigi.root_admin', 0));
  -- Recheck privilege after waiting: another root may have just demoted this caller.
  if not public.is_root_admin() then
    raise exception 'Root administrator access required' using errcode = '42501';
  end if;
  if p_role not in ('parent', 'teacher', 'admin', 'root_admin') then
    raise exception 'Invalid application role' using errcode = '22023';
  end if;
  select role into v_previous from public.user_roles where user_id = p_user_id for update;
  if not found then
    raise exception 'Account not found' using errcode = '22023';
  end if;
  if v_previous = 'root_admin' and p_role <> 'root_admin'
    and (select count(*) from public.user_roles where role = 'root_admin') <= 1 then
    raise exception 'Cannot remove the last root administrator' using errcode = '22023';
  end if;
  update public.user_roles set role = p_role, updated_at = now() where user_id = p_user_id;
  insert into private.audit_log (actor_id, action, subject, details)
  values (auth.uid(), 'account.role_changed', p_user_id::text,
    jsonb_build_object('before', v_previous, 'after', p_role));
end;
$$;

create function public.bootstrap_root_admin(p_email text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('laimigi.root_admin', 0));
  select id into v_user_id from auth.users
  where lower(email) = lower(btrim(p_email)) and email_confirmed_at is not null;
  if v_user_id is null then
    raise exception 'Create and verify the adult account before bootstrapping' using errcode = '22023';
  end if;
  if exists (select 1 from public.user_roles where user_id = v_user_id and role = 'root_admin') then
    return v_user_id;
  end if;
  if exists (select 1 from public.user_roles where role = 'root_admin') then
    raise exception 'A root administrator already exists; use role management' using errcode = '42501';
  end if;
  update public.user_roles set role = 'root_admin', updated_at = now() where user_id = v_user_id;
  if not found then
    raise exception 'Account profile is missing' using errcode = '22023';
  end if;
  insert into private.audit_log (actor_id, action, subject)
  values (v_user_id, 'account.root_bootstrap', v_user_id::text);
  return v_user_id;
end;
$$;

-- Explicit grants: never rely on Supabase's default PUBLIC function execution grant.
revoke all on public.profiles, public.user_roles, public.families, public.child_profiles,
  public.lessons, public.lesson_progress, public.ai_provider_settings
  from public, anon, authenticated;
grant select on public.profiles, public.user_roles, public.families, public.child_profiles,
  public.lessons, public.lesson_progress, public.ai_provider_settings to authenticated;
grant update (display_name, locale) on public.profiles to authenticated;
grant update (name) on public.families to authenticated;
grant insert, delete on public.child_profiles to authenticated;
grant update (nickname, age_band, avatar, locale) on public.child_profiles to authenticated;
grant insert, delete on public.lessons to authenticated;
grant update (title, description, body, locale, location, age_band, status) on public.lessons to authenticated;
grant all on public.profiles, public.user_roles, public.families, public.child_profiles,
  public.lessons, public.lesson_progress, public.ai_provider_settings to service_role;

revoke all on private.ai_provider_secrets, private.audit_log, private.ai_usage
  from public, anon, authenticated, service_role;
revoke all on sequence private.audit_log_id_seq from public, anon, authenticated, service_role;
revoke execute on function private.set_updated_at(), private.handle_new_user(), private.owns_child(uuid)
  from public, anon, authenticated, service_role;
-- RLS evaluates this function by object identity, with no schema discovery privileges.
grant execute on function private.owns_child(uuid) to authenticated;

revoke execute on function public.current_app_role(), public.is_staff(), public.is_root_admin(),
  public.configure_ai_provider(text, text, boolean, integer, integer, text, text, boolean),
  public.get_ai_provider_secret(text), public.reserve_ai_request(uuid, text),
  public.finish_ai_request(uuid, text), public.set_user_role(uuid, text), public.bootstrap_root_admin(text),
  public.complete_lesson(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.current_app_role(), public.is_staff(), public.is_root_admin(),
  public.configure_ai_provider(text, text, boolean, integer, integer, text, text, boolean),
  public.set_user_role(uuid, text), public.complete_lesson(uuid, uuid) to authenticated;
grant execute on function public.current_app_role(), public.is_staff(), public.is_root_admin(),
  public.get_ai_provider_secret(text), public.reserve_ai_request(uuid, text),
  public.finish_ai_request(uuid, text), public.bootstrap_root_admin(text) to service_role;

insert into public.ai_provider_settings (provider) values ('openrouter'), ('openai');

comment on table public.child_profiles is 'Pseudonymous heroes only. Do not add birthdates, medical details, school or real child names.';
comment on table private.ai_provider_secrets is 'Application-side authenticated encryption. The encryption key exists only in the server environment.';
comment on table private.ai_usage is 'Quota admission and status only. Never store prompts, completions, keys or child data.';
