-- The app no longer says "household" to people; it talks about sharing.
-- Same functions as the initial migration, with reworded error messages only.

create or replace function public.create_household(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if public.current_household_id() is not null then
    raise exception 'You are already set up';
  end if;

  insert into public.households (name, owner_id) values (trim(p_name), auth.uid())
  returning id into v_id;

  update public.profiles set household_id = v_id where id = auth.uid();
  return v_id;
end;
$$;

create or replace function public.accept_invite(p_invite_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.household_invites;
  v_current uuid := public.current_household_id();
begin
  select * into v_invite from public.household_invites
  where id = p_invite_id
    and email = (auth.jwt() ->> 'email')::extensions.citext
    and accepted_at is null
    and revoked_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'This invite is no longer valid';
  end if;

  if v_current is not null and exists (
    select 1 from public.households where id = v_current and owner_id = auth.uid()
  ) then
    raise exception 'You own a shared list already. Make someone else its owner before joining another.';
  end if;

  update public.profiles set household_id = v_invite.household_id where id = auth.uid();
  update public.household_invites set accepted_at = now() where id = v_invite.id;
  return v_invite.household_id;
end;
$$;

create or replace function public.leave_household()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.households where id = public.current_household_id() and owner_id = auth.uid()
  ) then
    raise exception 'Make someone else the owner before you leave';
  end if;
  update public.profiles set household_id = null where id = auth.uid();
end;
$$;

create or replace function public.remove_member(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household uuid := public.current_household_id();
begin
  if not exists (select 1 from public.households where id = v_household and owner_id = auth.uid()) then
    raise exception 'Only the owner can stop sharing with someone';
  end if;
  if p_profile_id = auth.uid() then
    raise exception 'You cannot remove yourself';
  end if;
  update public.profiles set household_id = null
  where id = p_profile_id and household_id = v_household;
  if not found then
    raise exception 'You don’t share with that person';
  end if;
end;
$$;

create or replace function public.transfer_ownership(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household uuid := public.current_household_id();
begin
  if not exists (select 1 from public.households where id = v_household and owner_id = auth.uid()) then
    raise exception 'Only the owner can hand over ownership';
  end if;
  if not exists (select 1 from public.profiles where id = p_profile_id and household_id = v_household) then
    raise exception 'You don’t share with that person';
  end if;
  update public.households set owner_id = p_profile_id where id = v_household;
end;
$$;
