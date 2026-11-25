-- A child lock belongs to a signed Supabase Auth session, not a browser preference.
-- Refreshing that session preserves session_id. Password reauthentication obtains
-- a new session; there is deliberately no authenticated unlock/delete function.

create table private.child_session_locks (
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  child_profile_id uuid not null,
  created_at timestamptz not null default now(),
  reauth_window_started_at timestamptz not null default now(),
  reauth_attempts integer not null default 0 check (reauth_attempts between 0 and 5),
  primary key (user_id, session_id)
);
-- No FK to child_profiles or auth.sessions: deleting a hero or revoking a session
-- must not erase a lock while an already-issued access token is still valid.
alter table private.child_session_locks enable row level security;
revoke all on private.child_session_locks from public, anon, authenticated, service_role;

create function private.current_verified_session_id() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  v_session text := auth.jwt() ->> 'session_id';
begin
  if v_session is null or v_session !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;
  return v_session::uuid;
end;
$$;

create function private.is_adult_session() returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null
    and (select private.current_verified_session_id()) is not null
    and not exists (
      select 1 from private.child_session_locks l
      where l.user_id = (select auth.uid())
        and l.session_id = (select private.current_verified_session_id())
    );
$$;

create function private.session_child_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select l.child_profile_id from private.child_session_locks l
  where l.user_id = (select auth.uid())
    and l.session_id = (select private.current_verified_session_id());
$$;

create function public.get_child_mode() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_child uuid;
begin
  if auth.uid() is null or private.current_verified_session_id() is null then
    raise exception 'A verified session is required' using errcode = '42501';
  end if;
  v_child := private.session_child_id();
  if v_child is null then return null; end if;
  return jsonb_build_object('hero_id', v_child);
end;
$$;

create function public.enter_child_mode(p_child_profile_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_session uuid := private.current_verified_session_id();
  v_existing uuid;
begin
  if v_user is null or v_session is null then
    raise exception 'A verified session is required' using errcode = '42501';
  end if;
  if p_child_profile_id is null then
    raise exception 'Child profile is required' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('laimigi.child.' || v_user::text || '.' || v_session::text, 0));
  select child_profile_id into v_existing from private.child_session_locks
  where user_id = v_user and session_id = v_session;
  if v_existing is not null then
    if v_existing <> p_child_profile_id then
      raise exception 'Adult reauthentication is required' using errcode = '42501';
    end if;
    return jsonb_build_object('hero_id', v_existing);
  end if;
  -- Resolve ownership independently of RLS helpers, which will become restricted
  -- as soon as this transaction installs the lock.
  if not exists (
    select 1 from public.child_profiles c join public.families f on f.id = c.family_id
    where c.id = p_child_profile_id and f.owner_id = v_user
  ) then
    raise exception 'Child profile is unavailable' using errcode = '42501';
  end if;
  insert into private.child_session_locks(user_id, session_id, child_profile_id)
  values (v_user, v_session, p_child_profile_id);
  insert into private.audit_log(actor_id, action, subject, details)
  values (v_user, 'session.child_mode_entered', v_session::text,
    jsonb_build_object('hero_id', p_child_profile_id));
  return jsonb_build_object('hero_id', p_child_profile_id);
end;
$$;

create function public.reserve_adult_reauth() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_lock private.child_session_locks;
begin
  if auth.uid() is null or private.current_verified_session_id() is null then
    raise exception 'A verified session is required' using errcode = '42501';
  end if;
  select * into v_lock from private.child_session_locks
  where user_id = auth.uid() and session_id = private.current_verified_session_id()
  for update;
  if not found then
    raise exception 'Child mode is not active' using errcode = '42501';
  end if;
  if v_lock.reauth_window_started_at <= now() - interval '15 minutes' then
    update private.child_session_locks set reauth_window_started_at = now(), reauth_attempts = 1
    where user_id = v_lock.user_id and session_id = v_lock.session_id;
  elsif v_lock.reauth_attempts >= 5 then
    raise exception 'Wait before trying again' using errcode = 'P0001';
  else
    update private.child_session_locks set reauth_attempts = reauth_attempts + 1
    where user_id = v_lock.user_id and session_id = v_lock.session_id;
  end if;
end;
$$;

create or replace function public.current_app_role() returns text
language sql stable security definer set search_path = '' as $$
  select role from public.user_roles
  where user_id = (select auth.uid()) and (select private.is_adult_session());
$$;

create or replace function private.owns_child(p_child_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select private.current_verified_session_id()) is not null
    and exists (
      select 1 from public.child_profiles c join public.families f on f.id = c.family_id
      where c.id = p_child_id and f.owner_id = (select auth.uid())
    )
    and ((select private.is_adult_session()) or (select private.session_child_id()) = p_child_id);
$$;

create function private.session_can_read_child(p_child_id uuid, p_family_id uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  -- Use the policy row's family_id instead of re-reading child_profiles. A stable
  -- function cannot see the newly inserted child during INSERT ... RETURNING.
  select (select private.current_verified_session_id()) is not null
    and exists (
      select 1 from public.families f
      where f.id = p_family_id and f.owner_id = (select auth.uid())
    )
    and ((select private.is_adult_session()) or (select private.session_child_id()) = p_child_id);
$$;

create function private.session_can_read_lesson(p_age_band text, p_locale text, p_status text)
returns boolean
language sql stable security definer set search_path = '' as $$
  select (select private.is_adult_session()) or (
    p_status = 'published' and exists (
      select 1 from public.child_profiles c join public.families f on f.id = c.family_id
      where c.id = (select private.session_child_id()) and f.owner_id = (select auth.uid())
        and c.age_band = p_age_band and c.locale = p_locale
    )
  );
$$;

-- Restrictive policies AND with every existing permissive rule. A browser using
-- its locked JWT directly against PostgREST cannot bypass the SvelteKit hook.
create policy profiles_adult_session on public.profiles as restrictive for all to authenticated
using ((select private.is_adult_session())) with check ((select private.is_adult_session()));
create policy roles_adult_session on public.user_roles as restrictive for all to authenticated
using ((select private.is_adult_session())) with check ((select private.is_adult_session()));
create policy families_adult_session on public.families as restrictive for all to authenticated
using ((select private.is_adult_session())) with check ((select private.is_adult_session()));

-- The previous read policy joins families under the caller's RLS. Families are
-- now hidden in child mode, so use the narrow ownership helper instead.
drop policy children_read_owner on public.child_profiles;
create policy children_read_owner on public.child_profiles for select to authenticated
using (private.session_can_read_child(id, family_id));
create policy children_active_hero on public.child_profiles as restrictive for select to authenticated
using (private.session_can_read_child(id, family_id));
create policy children_insert_adult on public.child_profiles as restrictive for insert to authenticated
with check ((select private.is_adult_session()));
create policy children_update_adult on public.child_profiles as restrictive for update to authenticated
using ((select private.is_adult_session())) with check ((select private.is_adult_session()));
create policy children_delete_adult on public.child_profiles as restrictive for delete to authenticated
using ((select private.is_adult_session()));

create policy lessons_child_scope on public.lessons as restrictive for select to authenticated
using (private.session_can_read_lesson(age_band, locale, status));
create policy lessons_insert_adult on public.lessons as restrictive for insert to authenticated
with check ((select private.is_adult_session()));
create policy lessons_update_adult on public.lessons as restrictive for update to authenticated
using ((select private.is_adult_session())) with check ((select private.is_adult_session()));
create policy lessons_delete_adult on public.lessons as restrictive for delete to authenticated
using ((select private.is_adult_session()));
create policy ai_settings_adult_session on public.ai_provider_settings as restrictive for all to authenticated
using ((select private.is_adult_session())) with check ((select private.is_adult_session()));

create policy progress_active_hero on public.lesson_progress as restrictive for select to authenticated
using (private.owns_child(child_profile_id));
create policy block_progress_active_hero on public.lesson_block_progress as restrictive for select to authenticated
using (private.owns_child(child_profile_id));
create policy rewards_active_hero on public.hero_rewards as restrictive for select to authenticated
using (private.owns_child(child_profile_id));

revoke execute on function private.current_verified_session_id(), private.is_adult_session(),
  private.session_child_id(), private.session_can_read_child(uuid,uuid), private.session_can_read_lesson(text,text,text),
  public.get_child_mode(), public.enter_child_mode(uuid), public.reserve_adult_reauth()
  from public, anon, authenticated, service_role;
-- Policy helpers are resolved by identity. The private schema remains unavailable
-- for direct browser queries and no private table is exposed through the Data API.
grant execute on function private.is_adult_session(), private.session_can_read_child(uuid,uuid), private.session_can_read_lesson(text,text,text)
  to authenticated;
grant execute on function public.get_child_mode(), public.enter_child_mode(uuid), public.reserve_adult_reauth()
  to authenticated;

comment on table private.child_session_locks is
  'Session locks and reauthentication attempt counts only. No JWT or refresh tokens. Keep tombstones until every token for that session is known expired; browser users cannot delete them.';
