-- Milestone 3: Spanish card text, meal outcomes after the fact, clearing
-- reaction flags (SPEC.md §5.4, §6.3).

-- Optional Spanish wording for things only the person can translate.
alter table public.allergens
  add column name_es text check (length(trim(name_es)) between 1 and 60);
alter table public.profiles
  add column chef_card_message_es text check (length(chef_card_message_es) <= 500);
grant update (chef_card_message_es) on public.profiles to authenticated;

-- Apply a meal's outcome to the eater's saved order: "fine" verifies it,
-- mild/bad flag it (bad is never downgraded to mild). Shared by log_meal and
-- set_meal_outcome so both follow the same rules.
create or replace function public.apply_meal_outcome(p_meal_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_meal public.meals;
  v_order public.safe_orders;
begin
  select * into v_meal from public.meals where id = p_meal_id;
  if not found or v_meal.outcome is null then
    return;
  end if;
  select * into v_order from public.safe_orders
  where dish_id = v_meal.dish_id and profile_id = v_meal.profile_id;
  if not found then
    return;
  end if;

  if v_meal.outcome = 'fine'
     and (v_order.last_verified_at is null or v_order.last_verified_at < v_meal.eaten_on::timestamptz) then
    update public.safe_orders set last_verified_at = v_meal.eaten_on::timestamptz where id = v_order.id;
  end if;

  if v_meal.outcome = 'bad' or (v_meal.outcome = 'mild' and v_order.reaction_flag is distinct from 'bad') then
    update public.safe_orders
    set reaction_flag = v_meal.outcome, reaction_flag_meal_id = v_meal.id, reaction_flag_set_at = now()
    where id = v_order.id;
  end if;
end;
$$;

-- Same as the Milestone 2 version, with the outcome rules moved to apply_meal_outcome.
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
    nullif(p_meal->>'outcome', ''),
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

  perform public.apply_meal_outcome(v_meal_id);
  return v_meal_id;
end;
$$;

-- Record "how did it go?" after the meal was logged (SPEC §5.4 outcome reminder).
create or replace function public.set_meal_outcome(p_meal_id uuid, p_outcome text, p_outcome_notes text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.meals
  set outcome = nullif(p_outcome, ''),
      outcome_notes = coalesce(nullif(trim(p_outcome_notes), ''), outcome_notes)
  where id = p_meal_id;
  if not found then
    raise exception 'Meal not found';
  end if;
  perform public.apply_meal_outcome(p_meal_id);
end;
$$;

-- Clear a reaction flag on purpose, keeping a dated note on the meal that set it.
create or replace function public.clear_reaction_flag(p_safe_order_id uuid, p_note text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order public.safe_orders;
begin
  select * into v_order from public.safe_orders where id = p_safe_order_id;
  if not found then
    raise exception 'Saved order not found';
  end if;

  if v_order.reaction_flag_meal_id is not null then
    update public.meals
    set outcome_notes = concat_ws(
      E'\n',
      outcome_notes,
      format('[Flag cleared %s] %s', to_char(now(), 'YYYY-MM-DD'), coalesce(nullif(trim(p_note), ''), 'No note'))
    )
    where id = v_order.reaction_flag_meal_id;
  end if;

  update public.safe_orders
  set reaction_flag = null, reaction_flag_meal_id = null, reaction_flag_set_at = null
  where id = p_safe_order_id;
end;
$$;

revoke execute on function public.apply_meal_outcome(uuid) from public, anon;
revoke execute on function public.set_meal_outcome(uuid, text, text) from public, anon;
revoke execute on function public.clear_reaction_flag(uuid, text) from public, anon;
grant execute on function public.apply_meal_outcome(uuid) to authenticated;
grant execute on function public.set_meal_outcome(uuid, text, text) to authenticated;
grant execute on function public.clear_reaction_flag(uuid, text) to authenticated;
