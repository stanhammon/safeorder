-- Milestone 2: data bundle and transactional writes (SPEC.md §5.1, §5.2, §5.4, §7.3).
-- All functions are security invoker, so row-level security still applies.

-- Everything the app needs, in one round trip. Meals older than two years load on demand.
create or replace function public.get_household_bundle()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'restaurants', coalesce((select jsonb_agg(r order by r.name) from public.restaurants r
                             where r.household_id = public.current_household_id()), '[]'::jsonb),
    'locations', coalesce((select jsonb_agg(l) from public.locations l
                           where l.household_id = public.current_household_id()), '[]'::jsonb),
    'dishes', coalesce((select jsonb_agg(d order by d.name) from public.dishes d
                        where d.household_id = public.current_household_id()), '[]'::jsonb),
    'dish_allergens', coalesce((select jsonb_agg(da) from public.dish_allergens da
                                where da.household_id = public.current_household_id()), '[]'::jsonb),
    'safe_orders', coalesce((select jsonb_agg(so) from public.safe_orders so
                             where so.household_id = public.current_household_id()), '[]'::jsonb),
    'modifications', coalesce((select jsonb_agg(m order by m.position) from public.modifications m
                               where m.household_id = public.current_household_id()), '[]'::jsonb),
    'meals', coalesce((select jsonb_agg(me order by me.eaten_on desc, me.created_at desc) from public.meals me
                       where me.household_id = public.current_household_id()
                         and me.eaten_on >= current_date - interval '2 years'), '[]'::jsonb)
  )
$$;

-- A restaurant always has at least one location; for a non-chain the UI hides it.
create or replace function public.create_restaurant(p_restaurant jsonb, p_location jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_household uuid := public.current_household_id();
  v_id uuid;
begin
  if v_household is null then
    raise exception 'Finish setting up before adding restaurants';
  end if;

  insert into public.restaurants (household_id, name, cuisine, is_chain, notes)
  values (
    v_household,
    trim(p_restaurant->>'name'),
    nullif(trim(p_restaurant->>'cuisine'), ''),
    coalesce((p_restaurant->>'is_chain')::boolean, false),
    nullif(trim(p_restaurant->>'notes'), '')
  )
  returning id into v_id;

  insert into public.locations (household_id, restaurant_id, label, address, lat, lng, map_url, notes)
  values (
    v_household,
    v_id,
    nullif(trim(p_location->>'label'), ''),
    nullif(trim(p_location->>'address'), ''),
    nullif(p_location->>'lat', '')::double precision,
    nullif(p_location->>'lng', '')::double precision,
    nullif(trim(p_location->>'map_url'), ''),
    nullif(trim(p_location->>'notes'), '')
  );

  return v_id;
end;
$$;

-- Replace a safe order's modifications with a JSON array of
-- {action, item, replacement?, allergen_id?, note?}, keeping array order.
create or replace function public.replace_modifications(p_safe_order_id uuid, p_household_id uuid, p_mods jsonb)
returns void
language sql
security invoker
set search_path = ''
as $$
  delete from public.modifications where safe_order_id = p_safe_order_id;
  insert into public.modifications (household_id, safe_order_id, position, action, item, replacement, allergen_id, note)
  select
    p_household_id,
    p_safe_order_id,
    (t.ord - 1)::int,
    t.m->>'action',
    trim(t.m->>'item'),
    nullif(trim(t.m->>'replacement'), ''),
    nullif(t.m->>'allergen_id', '')::uuid,
    nullif(trim(t.m->>'note'), '')
  from jsonb_array_elements(coalesce(p_mods, '[]'::jsonb)) with ordinality as t(m, ord);
$$;

create or replace function public.save_safe_order(p_dish_id uuid, p_profile_id uuid, p_note text, p_mods jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_household uuid;
  v_id uuid;
begin
  select household_id into v_household from public.dishes where id = p_dish_id;
  if v_household is null then
    raise exception 'Dish not found';
  end if;

  insert into public.safe_orders (household_id, dish_id, profile_id, note)
  values (v_household, p_dish_id, p_profile_id, nullif(trim(p_note), ''))
  on conflict (dish_id, profile_id) do update set note = excluded.note
  returning id into v_id;

  perform public.replace_modifications(v_id, v_household, p_mods);
  return v_id;
end;
$$;

-- Log one meal. Creates the person's safe order from the meal's mods if they
-- have none; replaces it when p_update_safe_order. A "fine" outcome verifies
-- the order; mild/bad set its reaction flag (bad is never downgraded to mild).
create or replace function public.log_meal(p_meal jsonb, p_update_safe_order boolean)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_dish public.dishes;
  v_order public.safe_orders;
  v_meal_id uuid;
  v_profile uuid := (p_meal->>'profile_id')::uuid;
  v_eaten date := coalesce(nullif(p_meal->>'eaten_on', '')::date, current_date);
  v_outcome text := nullif(p_meal->>'outcome', '');
  v_mods jsonb := coalesce(p_meal->'mods_snapshot', '[]'::jsonb);
  v_currency text;
begin
  select * into v_dish from public.dishes where id = (p_meal->>'dish_id')::uuid;
  if not found then
    raise exception 'Dish not found';
  end if;
  -- One day of slack: the person's local date can be ahead of the server's.
  if v_eaten > current_date + 1 then
    raise exception 'The meal date can’t be in the future';
  end if;

  select default_currency into v_currency from public.households where id = v_dish.household_id;

  insert into public.meals (
    household_id, dish_id, profile_id, location_id, eaten_on, taste_rating, outcome,
    outcome_notes, price_cents, currency, notes, mods_snapshot
  )
  values (
    v_dish.household_id,
    v_dish.id,
    v_profile,
    nullif(p_meal->>'location_id', '')::uuid,
    v_eaten,
    nullif(p_meal->>'taste_rating', '')::smallint,
    v_outcome,
    nullif(trim(p_meal->>'outcome_notes'), ''),
    nullif(p_meal->>'price_cents', '')::int,
    coalesce(nullif(p_meal->>'currency', ''), v_currency),
    nullif(trim(p_meal->>'notes'), ''),
    v_mods
  )
  returning id into v_meal_id;

  select * into v_order from public.safe_orders where dish_id = v_dish.id and profile_id = v_profile;
  if not found then
    insert into public.safe_orders (household_id, dish_id, profile_id)
    values (v_dish.household_id, v_dish.id, v_profile)
    returning * into v_order;
    perform public.replace_modifications(v_order.id, v_dish.household_id, v_mods);
  elsif p_update_safe_order then
    perform public.replace_modifications(v_order.id, v_dish.household_id, v_mods);
  end if;

  if v_outcome = 'fine' and (v_order.last_verified_at is null or v_order.last_verified_at < v_eaten::timestamptz) then
    update public.safe_orders set last_verified_at = v_eaten::timestamptz where id = v_order.id;
  end if;

  if v_outcome = 'bad' or (v_outcome = 'mild' and v_order.reaction_flag is distinct from 'bad') then
    update public.safe_orders
    set reaction_flag = v_outcome, reaction_flag_meal_id = v_meal_id, reaction_flag_set_at = now()
    where id = v_order.id;
  end if;

  return v_meal_id;
end;
$$;

revoke execute on function public.get_household_bundle() from public, anon;
revoke execute on function public.create_restaurant(jsonb, jsonb) from public, anon;
revoke execute on function public.replace_modifications(uuid, uuid, jsonb) from public, anon;
revoke execute on function public.save_safe_order(uuid, uuid, text, jsonb) from public, anon;
revoke execute on function public.log_meal(jsonb, boolean) from public, anon;
grant execute on function public.get_household_bundle() to authenticated;
grant execute on function public.create_restaurant(jsonb, jsonb) to authenticated;
grant execute on function public.replace_modifications(uuid, uuid, jsonb) to authenticated;
grant execute on function public.save_safe_order(uuid, uuid, text, jsonb) to authenticated;
grant execute on function public.log_meal(jsonb, boolean) to authenticated;
