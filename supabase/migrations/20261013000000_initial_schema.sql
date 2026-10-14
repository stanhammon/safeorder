-- SafeOrder initial schema (SPEC.md §4.3, §7.4)
-- Every household-scoped table carries household_id. Child tables use composite
-- foreign keys (parent_id, household_id) so a row can never point at another
-- household's data.

create extension if not exists citext with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_audit_fields()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, now());
    new.created_by := coalesce(new.created_by, auth.uid());
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Households & profiles
-- ---------------------------------------------------------------------------

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  owner_id uuid not null,
  stale_after_days int not null default 180 check (stale_after_days between 30 and 730),
  default_currency char(3) not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_by uuid
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  display_name text not null check (length(trim(display_name)) between 1 and 40),
  color text not null default '#2f7d6d' check (color ~ '^#[0-9a-fA-F]{6}$'),
  chef_card_message text check (length(chef_card_message) <= 500),
  server_card_theme text not null default 'light' check (server_card_theme in ('light', 'dark')),
  disclaimer_ack_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_by uuid
);

alter table public.households
  add constraint households_owner_fk foreign key (owner_id) references public.profiles (id);

create index profiles_household_idx on public.profiles (household_id);

-- RLS helper: the caller's household. security definer so policies on profiles
-- can use it without recursing into profiles' own policies.
create or replace function public.current_household_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select household_id from public.profiles where id = auth.uid()
$$;

-- Create a profile row for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, created_by)
  values (
    new.id,
    coalesce(nullif(left(split_part(new.email, '@', 1), 40), ''), 'Me'),
    new.id
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  email extensions.citext not null,
  invited_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_by uuid
);

create unique index household_invites_pending_uniq
  on public.household_invites (household_id, email)
  where accepted_at is null and revoked_at is null;

-- ---------------------------------------------------------------------------
-- Allergens
-- ---------------------------------------------------------------------------

create table public.allergens (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 40),
  is_preset boolean not null default false,
  sort_order int not null default 1000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_by uuid,
  check ((is_preset and household_id is null) or (not is_preset and household_id is not null))
);

create unique index allergens_name_uniq
  on public.allergens (coalesce(household_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

insert into public.allergens (name, is_preset, sort_order) values
  ('Milk', true, 10), ('Egg', true, 20), ('Peanut', true, 30), ('Tree nuts', true, 40),
  ('Soy', true, 50), ('Wheat', true, 60), ('Gluten', true, 70), ('Fish', true, 80),
  ('Shellfish (crustacean)', true, 90), ('Sesame', true, 100), ('Mustard', true, 110),
  ('Celery', true, 120), ('Lupin', true, 130), ('Molluscs', true, 140), ('Sulphites', true, 150);

create table public.household_hidden_allergens (
  household_id uuid not null references public.households (id) on delete cascade,
  allergen_id uuid not null references public.allergens (id) on delete cascade,
  primary key (household_id, allergen_id)
);

create table public.person_allergens (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  allergen_id uuid not null references public.allergens (id),
  household_id uuid not null references public.households (id) on delete cascade,
  kind text not null check (kind in ('allergy', 'preference')),
  notes text check (length(notes) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_by uuid,
  primary key (profile_id, allergen_id)
);

-- ---------------------------------------------------------------------------
-- Restaurants, locations, dishes
-- ---------------------------------------------------------------------------

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  cuisine text,
  is_chain boolean not null default false,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_by uuid,
  unique (id, household_id)
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  restaurant_id uuid not null,
  label text,
  address text,
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  map_url text,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_by uuid,
  unique (id, household_id),
  foreign key (restaurant_id, household_id) references public.restaurants (id, household_id) on delete cascade
);

create table public.dishes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  restaurant_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 120),
  description text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_by uuid,
  unique (id, household_id),
  foreign key (restaurant_id, household_id) references public.restaurants (id, household_id) on delete cascade
);

create unique index dishes_active_name_uniq
  on public.dishes (restaurant_id, lower(name))
  where archived_at is null;

create table public.dish_allergens (
  dish_id uuid not null,
  allergen_id uuid not null references public.allergens (id),
  household_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_by uuid,
  primary key (dish_id, allergen_id),
  foreign key (dish_id, household_id) references public.dishes (id, household_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Safe orders, modifications, meals
-- ---------------------------------------------------------------------------

create table public.safe_orders (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  dish_id uuid not null,
  profile_id uuid not null references public.profiles (id),
  note text,
  last_verified_at timestamptz,
  reaction_flag text check (reaction_flag in ('mild', 'bad')),
  reaction_flag_meal_id uuid,
  reaction_flag_set_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_by uuid,
  unique (id, household_id),
  unique (dish_id, profile_id),
  foreign key (dish_id, household_id) references public.dishes (id, household_id) on delete cascade
);

create table public.modifications (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  safe_order_id uuid not null,
  position int not null,
  action text not null check (action in ('remove', 'substitute', 'add', 'on_the_side', 'ask_kitchen', 'other')),
  item text not null check (length(trim(item)) between 1 and 200),
  replacement text,
  allergen_id uuid references public.allergens (id),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_by uuid,
  check (action <> 'substitute' or (replacement is not null and length(trim(replacement)) > 0)),
  foreign key (safe_order_id, household_id) references public.safe_orders (id, household_id) on delete cascade
);

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  dish_id uuid not null,
  profile_id uuid not null references public.profiles (id),
  location_id uuid,
  eaten_on date not null default current_date,
  taste_rating smallint check (taste_rating between 1 and 5),
  outcome text check (outcome in ('fine', 'mild', 'bad')),
  outcome_notes text,
  price_cents int check (price_cents >= 0),
  currency char(3) not null default 'USD',
  notes text,
  mods_snapshot jsonb not null default '[]'::jsonb check (jsonb_typeof(mods_snapshot) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_by uuid,
  unique (id, household_id),
  foreign key (dish_id, household_id) references public.dishes (id, household_id) on delete cascade,
  foreign key (location_id, household_id) references public.locations (id, household_id) on delete set null (location_id)
);

alter table public.safe_orders
  add constraint safe_orders_flag_meal_fk
  foreign key (reaction_flag_meal_id, household_id)
  references public.meals (id, household_id) on delete set null (reaction_flag_meal_id);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  dish_id uuid,
  meal_id uuid,
  storage_path text not null,
  thumb_path text not null,
  width int,
  height int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_by uuid,
  check (dish_id is not null or meal_id is not null),
  foreign key (dish_id, household_id) references public.dishes (id, household_id) on delete cascade,
  foreign key (meal_id, household_id) references public.meals (id, household_id) on delete cascade
);

create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  safe_order_id uuid,
  token text not null unique
    default rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '='),
  snapshot jsonb not null,
  revoked_at timestamptz,
  last_viewed_at timestamptz,
  view_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_by uuid,
  foreign key (safe_order_id, household_id) references public.safe_orders (id, household_id) on delete set null (safe_order_id)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index household_invites_household_idx on public.household_invites (household_id);
create index household_invites_email_idx on public.household_invites (email);
create index allergens_household_idx on public.allergens (household_id);
create index person_allergens_household_idx on public.person_allergens (household_id);
create index restaurants_household_idx on public.restaurants (household_id);
create index locations_household_idx on public.locations (household_id);
create index locations_restaurant_idx on public.locations (restaurant_id);
create index dishes_household_idx on public.dishes (household_id);
create index dishes_restaurant_idx on public.dishes (restaurant_id);
create index dish_allergens_household_idx on public.dish_allergens (household_id);
create index safe_orders_household_idx on public.safe_orders (household_id);
create index safe_orders_profile_idx on public.safe_orders (profile_id);
create index modifications_household_idx on public.modifications (household_id);
create index modifications_safe_order_idx on public.modifications (safe_order_id);
create index meals_household_idx on public.meals (household_id);
create index meals_dish_profile_idx on public.meals (dish_id, profile_id, eaten_on desc);
create index photos_household_idx on public.photos (household_id);
create index share_links_household_idx on public.share_links (household_id);
create index restaurants_name_trgm on public.restaurants using gin (name extensions.gin_trgm_ops);
create index dishes_name_trgm on public.dishes using gin (name extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Audit triggers
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'households', 'profiles', 'household_invites', 'allergens', 'person_allergens',
    'restaurants', 'locations', 'dishes', 'dish_allergens', 'safe_orders',
    'modifications', 'meals', 'photos', 'share_links'
  ] loop
    execute format(
      'create trigger set_audit_fields before insert or update on public.%I
         for each row execute function public.set_audit_fields()', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Data API grants
-- New Supabase projects no longer expose public tables automatically, so grant
-- explicitly. Signed-in users get table access (RLS below decides which rows);
-- anonymous visitors get nothing (share links go through an Edge Function).
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant execute on function public.current_household_id() to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.households enable row level security;
alter table public.profiles enable row level security;
alter table public.household_invites enable row level security;
alter table public.allergens enable row level security;
alter table public.household_hidden_allergens enable row level security;
alter table public.person_allergens enable row level security;
alter table public.restaurants enable row level security;
alter table public.locations enable row level security;
alter table public.dishes enable row level security;
alter table public.dish_allergens enable row level security;
alter table public.safe_orders enable row level security;
alter table public.modifications enable row level security;
alter table public.meals enable row level security;
alter table public.photos enable row level security;
alter table public.share_links enable row level security;

-- Households: members read; owner updates settings. Created/deleted only via RPC.
create policy households_select on public.households
  for select to authenticated using (id = public.current_household_id());
create policy households_update on public.households
  for update to authenticated
  using (id = public.current_household_id() and owner_id = auth.uid())
  with check (id = public.current_household_id());
revoke update on public.households from authenticated;
grant update (name, stale_after_days, default_currency) on public.households to authenticated;

-- Profiles: read self and housemates; write only your own cosmetic fields.
-- household_id changes only through the RPCs below.
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or (household_id is not null and household_id = public.current_household_id()));
create policy profiles_update on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke insert, update, delete on public.profiles from authenticated;
grant update (display_name, color, chef_card_message, server_card_theme, disclaimer_ack_at)
  on public.profiles to authenticated;

-- Invites: household members manage; invitees read theirs via get_my_invites().
create policy household_invites_select on public.household_invites
  for select to authenticated using (household_id = public.current_household_id());
create policy household_invites_insert on public.household_invites
  for insert to authenticated
  with check (household_id = public.current_household_id() and invited_by = auth.uid());
create policy household_invites_update on public.household_invites
  for update to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());
revoke update on public.household_invites from authenticated;
grant update (revoked_at, expires_at) on public.household_invites to authenticated;

-- Allergens: presets readable by everyone signed in; custom ones by household.
create policy allergens_select on public.allergens
  for select to authenticated
  using (household_id is null or household_id = public.current_household_id());
create policy allergens_insert on public.allergens
  for insert to authenticated
  with check (household_id = public.current_household_id() and not is_preset);
create policy allergens_update on public.allergens
  for update to authenticated
  using (household_id = public.current_household_id() and not is_preset)
  with check (household_id = public.current_household_id() and not is_preset);
create policy allergens_delete on public.allergens
  for delete to authenticated
  using (household_id = public.current_household_id() and not is_preset);

create policy household_hidden_allergens_all on public.household_hidden_allergens
  for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

-- Rows that point at a person must point at someone in the caller's household.
create policy person_allergens_all on public.person_allergens
  for all to authenticated
  using (household_id = public.current_household_id())
  with check (
    household_id = public.current_household_id()
    and exists (select 1 from public.profiles p where p.id = profile_id and p.household_id = public.current_household_id())
  );

create policy safe_orders_all on public.safe_orders
  for all to authenticated
  using (household_id = public.current_household_id())
  with check (
    household_id = public.current_household_id()
    and exists (select 1 from public.profiles p where p.id = profile_id and p.household_id = public.current_household_id())
  );

create policy meals_all on public.meals
  for all to authenticated
  using (household_id = public.current_household_id())
  with check (
    household_id = public.current_household_id()
    and exists (select 1 from public.profiles p where p.id = profile_id and p.household_id = public.current_household_id())
  );

-- Plain household-scoped tables.
do $$
declare
  t text;
begin
  foreach t in array array[
    'restaurants', 'locations', 'dishes', 'dish_allergens', 'modifications', 'photos', 'share_links'
  ] loop
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (household_id = public.current_household_id())
         with check (household_id = public.current_household_id())',
      t || '_all', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Household RPCs
-- ---------------------------------------------------------------------------

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
    raise exception 'You already belong to a household';
  end if;

  insert into public.households (name, owner_id) values (trim(p_name), auth.uid())
  returning id into v_id;

  update public.profiles set household_id = v_id where id = auth.uid();
  return v_id;
end;
$$;

create or replace function public.get_my_invites()
returns table (
  invite_id uuid,
  household_id uuid,
  household_name text,
  invited_by_name text,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, h.id, h.name, p.display_name, i.expires_at
  from public.household_invites i
  join public.households h on h.id = i.household_id
  join public.profiles p on p.id = i.invited_by
  where i.email = (auth.jwt() ->> 'email')::extensions.citext
    and i.accepted_at is null
    and i.revoked_at is null
    and i.expires_at > now()
    and h.id is distinct from public.current_household_id()
  order by i.created_at desc
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
    raise exception 'You own your current household. Transfer ownership or delete it before joining another one.';
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
    raise exception 'Transfer ownership before leaving the household';
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
    raise exception 'Only the household owner can remove members';
  end if;
  if p_profile_id = auth.uid() then
    raise exception 'You cannot remove yourself';
  end if;
  update public.profiles set household_id = null
  where id = p_profile_id and household_id = v_household;
  if not found then
    raise exception 'That person is not in your household';
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
    raise exception 'Only the household owner can transfer ownership';
  end if;
  if not exists (select 1 from public.profiles where id = p_profile_id and household_id = v_household) then
    raise exception 'That person is not in your household';
  end if;
  update public.households set owner_id = p_profile_id where id = v_household;
end;
$$;

revoke execute on function public.create_household(text) from public, anon;
revoke execute on function public.get_my_invites() from public, anon;
revoke execute on function public.accept_invite(uuid) from public, anon;
revoke execute on function public.leave_household() from public, anon;
revoke execute on function public.remove_member(uuid) from public, anon;
revoke execute on function public.transfer_ownership(uuid) from public, anon;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.get_my_invites() to authenticated;
grant execute on function public.accept_invite(uuid) to authenticated;
grant execute on function public.leave_household() to authenticated;
grant execute on function public.remove_member(uuid) to authenticated;
grant execute on function public.transfer_ownership(uuid) to authenticated;
