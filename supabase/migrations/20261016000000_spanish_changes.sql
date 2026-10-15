-- Optional Spanish wording for each change, shown on the Spanish server card.
-- Blank means "use the app's built-in dictionary, else show the English".

alter table public.modifications
  add column item_es text check (length(trim(item_es)) between 1 and 200),
  add column replacement_es text check (length(trim(replacement_es)) between 1 and 200);

-- Same as before, plus the two Spanish fields.
create or replace function public.replace_modifications(p_safe_order_id uuid, p_household_id uuid, p_mods jsonb)
returns void
language sql
security invoker
set search_path = ''
as $$
  delete from public.modifications where safe_order_id = p_safe_order_id;
  insert into public.modifications (
    household_id, safe_order_id, position, action, item, replacement, allergen_id, note, item_es, replacement_es
  )
  select
    p_household_id,
    p_safe_order_id,
    (t.ord - 1)::int,
    t.m->>'action',
    trim(t.m->>'item'),
    nullif(trim(t.m->>'replacement'), ''),
    nullif(t.m->>'allergen_id', '')::uuid,
    nullif(trim(t.m->>'note'), ''),
    nullif(trim(t.m->>'item_es'), ''),
    nullif(trim(t.m->>'replacement_es'), '')
  from jsonb_array_elements(coalesce(p_mods, '[]'::jsonb)) with ordinality as t(m, ord);
$$;
