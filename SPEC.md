# SafeOrder: Restaurant Allergy Order Tracker

**Status:** Draft v1 · **Date:** 2026-10-13 · **Owner:** Stan Hammon

---

## 1. Purpose

A mobile-first web app (PWA) for a household to record what each member ordered at specific restaurants, and the exact modifications needed to avoid their food allergies. Its main job is to answer one question quickly while standing at a counter or sitting at a table:

> "What can I safely order here, and exactly what do I tell the server?"

Secondary jobs:
- Keep a history of meals: taste ratings, reactions, and prices.
- Show a clear allergy card to restaurant staff.
- Share a safe order with people outside the household.

### 1.1 Safety disclaimer (product principle)
The app is a **personal memory aid, not a safety guarantee**. It never says a dish is "safe" in absolute terms. Wherever it summarizes safety, it uses wording like "Your saved order" or "No uncovered allergens in your notes", and it shows a persistent reminder to confirm with staff every time. The disclaimer appears:
- during onboarding, where the user must acknowledge it,
- in the footer of the dish view, the server card, and shared links,
- next to every automated coverage warning.

---

## 2. Decisions Summary

| Area | Decision |
|---|---|
| Primary device | Phone, used at the restaurant; installable PWA |
| Users | Household (me + family/partner); **every person has their own login** |
| Data sharing | One shared household space; each person has their own allergy profile |
| Auth | Supabase magic-link email; members join by email invite |
| Storage | Supabase (Postgres + Storage), synced across devices |
| Offline | **Read-only offline**; writes need a connection |
| Allergens | Preset major-allergen list plus custom household allergens |
| Allergen kinds | `allergy` vs. `preference` (no severity levels) |
| Core model | **Dish-primary**: Restaurant → Dish → per-person *Safe Order* (saved mods) → Meal logs |
| Modifications | Structured (action + item + optional linked allergen) plus a free-text note |
| Meal outcome | Taste rating (1–5) **and** a separate safety outcome (fine / mild / bad) |
| Extra fields | Photos, price |
| Restaurants | Manual entry; GPS coordinates captured with geolocation for "near me" |
| Chains | Chain flag; dishes shared across all locations; per-location notes |
| Home screen | Search bar, then nearby restaurants, then recent restaurants |
| Search/filter | Restaurant/dish name; "safe for person X" |
| Staleness | "Re-confirm with staff" badge after **6 months** (configurable), plus manual archive |
| Per-person mods | One Safe Order per (dish, person) |
| Server card | Per-dish full-screen card **plus** a general chef/allergy card |
| Safety checks | Light: tag a dish's allergens and warn when one is not covered by a mod |
| Reactions | A bad or mild reaction flags the dish for that person; the flag is cleared manually |
| Portability | JSON/CSV export, JSON import, printable allergy-card PDF, revocable share links |
| Share links | Read-only snapshot, **permanent until revoked** |
| Stack | React + Vite + TypeScript PWA, Supabase |
| Hosting | Not decided; keep it portable (static SPA plus Supabase) |

---

## 3. Users & Roles

> **Wording rule (decided 2026-10-14):** the UI never says "household". The app is written for an individual ("you", "your allergies"). Sharing appears only as an option: "Share with someone", "Shared with", "Leave shared list". "Household" stays an internal term in the schema and code.

- **Household:** the top-level tenant. In v1 a user belongs to exactly one household.
- **Member:** an authenticated user (`profiles` row tied to `auth.users`). Every member can read and write all household data, including other members' safe orders. This is useful when you order for a partner. Each member owns their own allergy profile, but any member may edit any profile; edits are recorded in `updated_by`.
- **Owner:** whoever created the household. Only the owner can remove members, rename the household, or delete it. Ownership can be transferred.
- **Anonymous viewer:** someone opening a share link. They can see only that link's snapshot.

### 3.1 Onboarding flow
1. Enter your email, then click the magic link.
2. First sign-in: choose **Create household** (you enter a name and become the owner) or **I have an invite** (the invite is usually auto-detected from the pending invite for that email).
3. Set your display name and pick a color, used as an avatar chip.
4. Allergy setup: tick preset allergens, add custom ones, and mark each one as *allergy* or *preference*.
5. Acknowledge the safety disclaimer.
6. Optionally allow location access (explained as being used only to sort restaurants by distance).

### 3.2 Invites
- The owner or any member invites by email. This creates a `household_invites` row. **As built in v1, the app sends no email:** it opens the share sheet (or copies to the clipboard) with a message containing the app link and the invited address. When the invitee signs in with that email, onboarding lists the pending invite with a **Join** button (`get_my_invites()` / `accept_invite()`). Sending from an Edge Function (`inviteUserByEmail`) is a later enhancement. It is avoided for now because of the low rate limit on Supabase's built-in email sender, and because PKCE links opened on a different device fail.
- Invites expire after 7 days and can be resent or revoked.
- An invited user who already belongs to another household can join directly, which removes them from the old household, unless they **own** that household: then they must transfer ownership first. Their old-household meal logs stay with that household. In v1 those logs show "Former member", without the name.
- Sign-in accepts either the magic link or the 6-digit code from the same email. The code path is needed for an installed PWA, whose storage is separate from the browser that opens email links.

---

## 4. Domain Model

### 4.1 Concepts
- **Restaurant:** a brand or venue (e.g. "Chipotle", "Luigi's Trattoria"). It has an `is_chain` flag.
- **Location:** a physical place for a restaurant, with an address and lat/lng. A non-chain restaurant has exactly one location, and the UI hides the location concept for it. A chain has one or more.
- **Dish:** a menu item belonging to a **restaurant**, not a location, so it is shared across a chain's locations. It is optionally tagged with the allergens it contains.
- **Safe Order:** the saved "how I order this" for one **person** and one **dish**: an ordered list of modifications plus a note. This is what the server card shows.
- **Modification:** `action` + `item` + optional `allergen` + optional note.
  - Actions: `remove`, `substitute` (needs `item` and `replacement`), `add`, `on_the_side`, `ask_kitchen` (e.g. "ask whether the fryer is shared"), `other`.
- **Meal:** one occasion when a person ate a dish: date, location, taste rating, safety outcome, price, notes, photos, and a **snapshot of the mods actually used**. These may differ from the saved Safe Order.
- **Allergen:** a preset (global) or custom (household-scoped) entry.
- **Person allergen:** links a person to an allergen with `kind` = `allergy` | `preference`.

### 4.2 Preset allergens
Milk, Egg, Peanut, Tree nuts, Soy, Wheat, Gluten, Fish, Shellfish (crustacean), Sesame, Mustard, Celery, Lupin, Molluscs, Sulphites.
(This covers the US Top 9 and the EU 14. Presets cannot be edited or deleted, but a household can hide unused ones from pickers.)

### 4.3 Schema (Postgres / Supabase)

All IDs are `uuid` generated with `gen_random_uuid()` (client-generated UUIDs are also accepted, to support import). All tables have `created_at`, `updated_at` (trigger-maintained), `created_by`, and `updated_by`. Every household-scoped table carries `household_id` directly so RLS policies stay simple and fast.

```sql
households (
  id uuid pk,
  name text not null,
  owner_id uuid not null references profiles(id),
  stale_after_days int not null default 180,
  created_at, updated_at
)

profiles (
  id uuid pk references auth.users(id) on delete cascade,
  household_id uuid references households(id),   -- null until they join or create one
  display_name text not null,
  color text not null,                            -- hex, for avatar chips
  chef_card_message text,                         -- custom text on the general allergy card
  disclaimer_ack_at timestamptz,
  created_at, updated_at
)

household_invites (
  id uuid pk,
  household_id uuid not null,
  email citext not null,
  invited_by uuid not null references profiles(id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  unique (household_id, email) where accepted_at is null and revoked_at is null
)

allergens (
  id uuid pk,
  household_id uuid null,        -- null = preset/global
  name text not null,
  is_preset boolean not null default false,
  unique (coalesce(household_id, '00000000-...'), lower(name))
)

household_hidden_allergens (household_id, allergen_id, pk(household_id, allergen_id))

person_allergens (
  profile_id uuid references profiles(id) on delete cascade,
  allergen_id uuid references allergens(id),
  household_id uuid not null,
  kind text not null check (kind in ('allergy','preference')),
  notes text,                    -- e.g. "trace amounts OK", "cross-contact matters"
  primary key (profile_id, allergen_id)
)

restaurants (
  id uuid pk,
  household_id uuid not null,
  name text not null,
  cuisine text,                  -- free text with autocomplete from existing values
  is_chain boolean not null default false,
  notes text,                    -- restaurant-wide notes ("staff very allergy-aware")
  archived_at timestamptz
)

locations (
  id uuid pk,
  household_id uuid not null,
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  label text,                    -- "Downtown", "Airport T2"; null for a non-chain
  address text,
  lat double precision,
  lng double precision,
  map_url text,                  -- optional pasted Google/Apple Maps link
  notes text,                    -- per-location notes ("this one has a dedicated fryer")
  archived_at timestamptz
)

dishes (
  id uuid pk,
  household_id uuid not null,
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  name text not null,
  description text,
  archived_at timestamptz,       -- "no longer on menu"
  unique (restaurant_id, lower(name)) where archived_at is null
)

dish_allergens (               -- "this dish contains X as served by default"
  dish_id uuid references dishes(id) on delete cascade,
  allergen_id uuid references allergens(id),
  household_id uuid not null,
  primary key (dish_id, allergen_id)
)

safe_orders (
  id uuid pk,
  household_id uuid not null,
  dish_id uuid not null references dishes(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  note text,
  last_verified_at timestamptz,          -- set by a "fine" meal or a manual "confirmed with staff"
  reaction_flag text check (reaction_flag in ('mild','bad')),
  reaction_flag_meal_id uuid references meals(id) on delete set null,
  reaction_flag_set_at timestamptz,
  unique (dish_id, profile_id)
)

modifications (
  id uuid pk,
  household_id uuid not null,
  safe_order_id uuid not null references safe_orders(id) on delete cascade,
  position int not null,                 -- display order
  action text not null check (action in ('remove','substitute','add','on_the_side','ask_kitchen','other')),
  item text not null,                    -- "cheese", "bun", "Is the fryer shared?"
  replacement text,                      -- required when action = 'substitute'
  allergen_id uuid references allergens(id),   -- the allergen this mod addresses (optional)
  note text
)

meals (
  id uuid pk,
  household_id uuid not null,
  dish_id uuid not null references dishes(id) on delete cascade,
  profile_id uuid not null references profiles(id),
  location_id uuid references locations(id) on delete set null,
  eaten_on date not null default current_date,
  taste_rating smallint check (taste_rating between 1 and 5),
  outcome text check (outcome in ('fine','mild','bad')),   -- null = not recorded yet
  outcome_notes text,
  price_cents int check (price_cents >= 0),
  currency char(3) not null default 'USD',
  notes text,
  mods_snapshot jsonb not null default '[]'  -- array of {action,item,replacement,allergen_id,allergen_name,note}
)

photos (
  id uuid pk,
  household_id uuid not null,
  dish_id uuid references dishes(id) on delete cascade,
  meal_id uuid references meals(id) on delete cascade,
  storage_path text not null,            -- photos/{household_id}/{uuid}.webp
  thumb_path text not null,              -- photos/{household_id}/{uuid}_thumb.webp
  width int, height int,
  check (dish_id is not null or meal_id is not null)
)

share_links (
  id uuid pk,
  household_id uuid not null,
  safe_order_id uuid references safe_orders(id) on delete set null,
  token text not null unique,            -- 32 random bytes, base64url
  snapshot jsonb not null,               -- frozen render data (see §8.3)
  created_by uuid not null,
  revoked_at timestamptz,
  last_viewed_at timestamptz,
  view_count int not null default 0
)
```

**Indexes:** `(household_id)` on every table; `dishes(restaurant_id)`; `meals(dish_id, profile_id, eaten_on desc)`; `safe_orders(profile_id)`; `locations(restaurant_id)`; `pg_trgm` GIN on `restaurants.name` and `dishes.name` (for future server-side search; v1 searches on the client).

### 4.4 Derived values (computed on the client from cached data)
- `dish.last_eaten_on`: max `meals.eaten_on`.
- `safe_order.is_stale`: `coalesce(last_verified_at, created_at) < now() - household.stale_after_days`.
- `safe_order.uncovered_allergens`: (person's `allergy`-kind allergens ∩ `dish_allergens`) − (allergens linked by that safe order's mods).
- `safe_order.uncovered_preferences`: the same calculation, for `preference`-kind allergens. Shown as a softer notice.
- `dish.last_price`: the most recent non-null `meals.price_cents`.

---

## 5. Business Rules

### 5.1 Logging a meal
- Defaults to **today**, the **current user**, and the **nearest known location** of that restaurant (if GPS is available and one is within 300 m). Otherwise it uses the most recently used location.
- `mods_snapshot` starts as a copy of the person's Safe Order mods. The user can edit it for this meal only.
- After saving, if the snapshot differs from the Safe Order, prompt: **"Update your saved order with these changes?"** [Update] [Keep saved order as is].
- If no Safe Order exists for (dish, person), saving the meal **creates one** from the snapshot.
- The outcome can be left blank at save time. The app reminds the user later (see §5.4).

### 5.2 Verification and staleness
- `last_verified_at` is set to the meal date when a meal with `outcome = fine` is logged and it is newer than the current value.
- A **"Confirmed with staff today"** button on the dish view also sets it to now.
- A Safe Order is **stale** when its verification is older than `stale_after_days` (default 180, editable in Household settings: 30–730). Stale orders show an amber **"Re-confirm with staff"** badge. They stay in search results.
- **Archive dish:** hides the dish from default lists and search ("Show archived" toggle). History, safe orders, and share links remain. Share-link views show "This dish may no longer be on the menu." Unarchiving is allowed.
- **Archive restaurant/location:** works the same way, cascading visually but not in the data.

### 5.3 Coverage warnings (light safety check)
- Shown only when a dish has allergen tags. **If a dish has no tags, the app shows "Allergens not recorded" (grey), never a green state.**
- An uncovered **allergy** shows as a red warning: "Contains Milk: no modification addresses it."
- An uncovered **preference** shows as a grey note.
- A mod with `action = ask_kitchen` linked to an allergen **counts as covering it**, but the server card shows it as a question rather than an instruction.
- Coverage is **never** shown as "Safe ✓". The best state is "All tagged allergens addressed" with the disclaimer next to it.

### 5.4 Reactions
- Logging a meal with `outcome = bad` sets `safe_order.reaction_flag = 'bad'` (red). `mild` sets `'mild'` (amber) unless the flag is already `'bad'`.
- Flagged orders show a prominent banner on the dish, a red/amber dot in lists, and are **sorted to the bottom** of "safe for person X" results. They are still shown, not hidden.
- **Clearing** a flag requires an explicit action ("Clear reaction flag") with an optional note. That note is stored on the triggering meal's `outcome_notes` along with a timestamp. Logging a later `fine` meal does **not** clear the flag automatically. Instead, it prompts: "Last time you had a reaction. Clear the flag?"
- **Outcome reminder:** meals saved with no outcome show a "How did it go?" chip on Home for 48 hours afterward. No push notifications in v1.

### 5.5 Chains
- When adding a restaurant, a toggle asks **"This is a chain (multiple locations)"**.
- When you visit a new location of a chain: the "Log meal" flow offers "New location…", which captures GPS and an address.
- **Converting** a non-chain to a chain is allowed; the existing location becomes the first labelled location. Converting a chain back to a non-chain is allowed only when it has at most one non-archived location.
- Dish views at a chain show per-location notes in a collapsible section ("At Downtown: dedicated fryer").

### 5.6 Deletion
- Deleting is a two-step confirmation and is **hard delete** for meals and photos. For dishes and restaurants, the UI offers **Archive** as the primary action and **Delete permanently** as a secondary, destructive one that cascades to safe orders, meals, photos, and share links. The confirmation text states the count ("This deletes 14 meal logs and 3 photos").
- Deleting a person allergen that mods reference: the mods keep `allergen_id`, and coverage is recalculated.
- Deleting a custom allergen in use: blocked, with "Used by N dishes/mods; merge into another allergen or remove those first." Offer **Merge** (repoints all references).

---

## 6. UX / UI

### 6.1 Principles
- **Usable one-handed at a table.** Primary actions sit in the bottom half of the screen, tap targets are at least 48 px, and there is a bottom tab bar.
- **Speed.** A known dish's server card is no more than 3 taps from launch. A meal log for a known dish is no more than 4 taps.
- **Calm, discreet look.** Nothing alarming unless it needs attention. Red is reserved for reactions and uncovered allergies.
- **Accessible.** WCAG 2.2 AA, light and dark themes following the system setting, support for dynamic type (rem units) and screen readers, and color never used as the only signal (icons and text accompany it).

### 6.2 Navigation
Bottom tabs: **Home** · **Log** (+) · **People** · **Settings**.

### 6.3 Screens

**Home**
- A sticky search field at the top. Typing searches restaurants and dishes together, with results grouped.
- **Person filter chip row** below the search, e.g. `[Me] [Alex] [Everyone]`. It defaults to the current user and drives the "safe for person X" filter on every screen. With "Everyone" selected, a dish appears if it has any safe order.
- **Nearby** section: restaurants within 2 km, sorted by distance (only if location permission is granted). Each row shows the name, distance, and how many safe orders the selected person has there.
- **Recent** section: the last 10 restaurants by most recent meal.
- A "How did it go?" chip strip for meals missing an outcome.
- Empty state: "Add your first restaurant" button.

**Restaurant detail**
- Header: name, cuisine, chain badge, restaurant notes, and a location picker if it is a chain (defaults to the nearest).
- **Your orders here** (for the selected person): list of dishes that have a safe order. Each row shows the dish name, a one-line mod summary ("No cheese · Sub GF bun"), the **average taste rating** across all rated meals of that dish with the count ("★ 4.3 (6)"; hidden when unrated, and also shown on "Other dishes" rows), and badges (stale, reaction, uncovered). Tapping a row opens Dish detail. A quick **Show server** button sits on each row.
- **Other dishes**: dishes with no safe order for this person. These are other members' dishes or tagged-only dishes, collapsed by default.
- FAB: **+ Dish**. Overflow menu: edit, add location, archive.

**Dish detail**
- Name, description, photos carousel, allergen tags ("Contains: Milk, Wheat"), last price, and per-location notes.
- A **person tab strip**: one tab per member who has a safe order, plus "+ Add for …".
- For the selected person:
  - The coverage panel (§5.3) and staleness/reaction banners.
  - The ordered list of mods, rendered as sentences: "**Remove** cheese (milk)", "**Substitute** bun → gluten-free bun (wheat)", "**Ask kitchen:** is the fryer shared? (shellfish)".
  - The note.
  - Buttons: **Show server** (primary), **Log meal**, **Edit order**, **Confirmed with staff today**, **Share**.
  - Meal history for that person: date, location, ★ rating, outcome icon, price, and photo thumbnails.

**Log meal (sheet/flow)**
1. Pick a restaurant (search or nearby; preselected if launched from a restaurant or dish).
2. Pick a dish (search or create inline).
3. Pick the person (defaults to the current user).
4. Review mods, prefilled from the safe order, with an inline editor.
5. Optional fields: rating, outcome, price, photo, notes, date (defaults to today), location.
6. Save.

When the flow is launched from Dish detail, steps 1–3 are skipped.

**Mod editor**
- Each row: an action segmented control, an item text field (autocomplete from household history), a replacement field (only for substitute), an optional allergen chip picker limited to the **person's own allergens first** with "other…" for the rest, and an optional note.
- Rows can be reordered by dragging and deleted by swiping.
- A "Quick add" chip row of frequent mods for this person ("No butter", "Sub GF bun", …).

**Server card (per dish)**
- Full-screen and high contrast (black on white or white on black, user's choice), with a minimum font size of 28 px and auto-fit.
- Contents: "**I have food allergies**", the person's allergy list (only `allergy` kind), the dish name, the mods as imperative short lines, any `ask_kitchen` items as questions, and a footer line: "Please tell me if this can't be done safely."
- Uses the Screen Wake Lock API while open. Supports landscape rotation. As built, it closes with a clear **Done** button rather than tap-to-dismiss, so it can't close by accident.
- **Language (added 2026-10-15):** a small **Español / English** pill at the top-right of the card switches the card language. The choice is remembered on that device. Fixed wording, change verbs ("Sin…", "Cambiar … por …", "… aparte") and preset allergen names are translated. Typed change items are translated too (added 2026-10-16). Each change can have its own Spanish wording (`modifications.item_es` / `replacement_es`, an optional box in the change editor). If that's left blank, the card uses a built-in dictionary of common restaurant words, which matches only exact words, plus "gluten-free X" / "dairy-free X" / "extra X". The editor shows what the card will say. On the Spanish card, each change also shows the English in small text underneath, so a bad translation can't go unnoticed. Anything still untranslated (dish names, unknown words, notes) stays as typed, and the card then says "Algunos detalles están en inglés." Custom allergens can have an optional Spanish name (`allergens.name_es`, edited in Settings), and the chef message can have an optional Spanish version (`profiles.chef_card_message_es`).
- A brightness tip ("Turn brightness up") appears the first time only.

**Chef card (general)**
- The same visual style. It lists the person's allergies (and optionally preferences under a separate "Preferences (not allergies)" heading), the custom `chef_card_message`, and cross-contact notes from `person_allergens.notes`.
- Reachable from People → person → **Chef card**, and from a long-press on the person chip on Home.
- **Print/PDF**: a wallet-size card (CR80, 85.6 × 54 mm), front and back, plus an A4/Letter sheet option with cut marks. It is generated on the client with `@react-pdf/renderer`.

**People**
- A list of household members. Tapping one opens their allergies (add/remove, change kind, notes), chef card, chef message, and stats (number of safe orders, reaction count).

**Settings**
- Household: name, members, invites, staleness threshold, hidden allergens, custom allergens (rename/merge/delete).
- Account: display name, color, server-card theme, sign out, delete account.
- Data: Export JSON, Export CSV, Import JSON, manage share links (list with revoke).
- About: the disclaimer and version.

**Public share view** (`/s/:token`)
- A minimal page with no app chrome and no login. It shows the restaurant, dish, person's display name (or "Guest" if the sharer chose to anonymize), their allergies, the mods, a note, the snapshot date ("Saved on Oct 13, 2026"), and the disclaimer.
- A revoked or unknown token shows "This link is no longer available."
- The page sends `<meta name="robots" content="noindex">` and `Referrer-Policy: no-referrer`.

### 6.4 Offline behavior (read-only)
- The app shell is precached by the service worker (Workbox via `vite-plugin-pwa`).
- All household data is held in TanStack Query and persisted to IndexedDB (`@tanstack/query-async-storage-persister` + `idb-keyval`). The dataset is small, so it is loaded in full on startup and on focus.
- Photo **thumbnails** use a cache-first strategy (bounded to 200 entries / 50 MB). Full-size photos load from the network only.
- When offline:
  - A banner appears: "Offline: showing saved data from <time>".
  - All write actions are **disabled** with the tooltip "Needs a connection".
  - **The server card and chef card work fully offline.** This is the critical path.
  - Search, the person filter, and "nearby" (GPS distance is computed on the client) all work.
- **Draft protection:** if the connection drops mid-form, the form contents are kept in `localStorage` as a draft and restored when the user comes back online. This is a convenience, not a sync queue.

### 6.5 Location
- Location is requested only on first use of "Nearby", with an explanatory pre-prompt.
- The app uses `getCurrentPosition` with `maximumAge: 60s` and a 10 s timeout. It does not track position in the background.
- When adding a location: "Use my current location" captures lat/lng, with an optional address field. There is no reverse geocoding in v1, which avoids API keys.
- If permission is denied, the Nearby section is hidden and a small "Enable location" link remains.

---

## 7. Technical Architecture

### 7.1 Stack
- **Frontend:** React 19 + Vite + TypeScript (strict), React Router (data routers), TanStack Query, Tailwind CSS, Radix UI primitives (dialogs, tabs, popovers), react-hook-form + Zod, `vite-plugin-pwa`, `@react-pdf/renderer` (lazy-loaded), `browser-image-compression`, MiniSearch for client-side fuzzy search.
- **Backend:** Supabase: Postgres (with RLS), Auth (magic link), Storage (private `photos` bucket), Edge Functions (Deno) for invites, share-link resolution, and account deletion.
- **Tooling:** npm, oxlint (from the Vite template), Prettier, Vitest + Testing Library, Playwright (mobile viewport e2e), Supabase CLI (local dev, migrations, generated types `supabase gen types typescript`), pgTAP for RLS tests.
- **Hosting:** the frontend is a static build (`dist/`) deployable to any static host with HTTPS and SPA fallback (Vercel/Netlify/Cloudflare Pages/self-hosted Caddy). Supabase is hosted, on the free tier at first. Config comes only from env (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).

### 7.2 Code layout
```
src/
  app/            routes, layout, providers
  features/
    restaurants/  dishes/  safe-orders/  meals/  people/  share/  settings/  server-card/
  lib/
    supabase.ts  queries/ (query keys + fetchers)  coverage.ts  staleness.ts  geo.ts  search.ts  export/
  components/     shared UI
supabase/
  migrations/     seed.sql (preset allergens)  functions/  tests/ (pgTAP)
```

### 7.3 Data loading
- On sign-in or app focus: a single RPC `get_household_bundle()` returns all non-photo household rows (restaurants, locations, dishes, dish_allergens, safe_orders, modifications, meals (last 2 years; older meals load on demand), allergens, person_allergens, profiles). Expected size is under 1 MB even after years of use.
- Writes go through `supabase-js` table calls, with optimistic updates in TanStack Query, followed by invalidation of the affected keys.
- Multi-row writes (save a safe order and its mods; log a meal, which may create a safe order and set flags) go through **Postgres RPC functions** so they run in one transaction: `save_safe_order(order jsonb, mods jsonb)`, `log_meal(meal jsonb, update_safe_order bool)`.
- **Realtime:** subscribe to Supabase Realtime changes on household tables. A change triggers a debounced bundle refetch, so a partner's edits appear without a reload.
- **Concurrency:** last write wins, using `updated_at`. Edits to a safe order send `updated_at` as an `if-match`. If it is stale, the RPC raises `conflict` and the UI shows "Alex changed this order a moment ago. Review their version?" with a diff and the choice to keep theirs or overwrite.

### 7.4 Security
- **RLS on every table.** The policy pattern is:
  `household_id = (select household_id from profiles where id = auth.uid())`,
  wrapped in a `security definer` stable function `current_household_id()` for performance.
- `allergens`: presets (`household_id is null`) are readable by all authenticated users. Custom allergens follow the household policy.
- `profiles`: readable by members of the same household. Writable only by self, except that the owner may set `household_id = null` (remove a member) through an RPC.
- `share_links`: there is no anonymous table access. The public view calls the Edge Function `resolve-share?token=…`, which uses the service role, checks `revoked_at is null`, increments `view_count`, and returns only `snapshot`. It is rate-limited per IP (60/min).
- **Storage:** the `photos` bucket is private, with the path prefix `{household_id}/`. Storage policies check the prefix against `current_household_id()`. The client gets images through signed URLs (1 hour), cached in memory.
- **Share link photos:** none in v1. Snapshots contain no photo URLs, to avoid leaking signed URLs.
- Magic link redirect URLs are restricted to the configured site URLs.
- Health data note: allergy data is sensitive personal data. The app has no analytics or third-party trackers, and error logging (if added) must scrub request bodies.

### 7.5 Photos
- Compressed on the client before upload: longest edge 1600 px, WebP quality 0.8, plus a 320 px thumbnail. EXIF (including GPS) is stripped by re-encoding.
- Limits: 6 photos per meal, 6 per dish, and 10 MB per original before compression.
- Upload happens after the meal row is saved. If an upload fails, the photo row is not created and the user gets a toast with Retry.
- Orphan cleanup: a scheduled function (daily) deletes storage objects with no `photos` row that are more than 24 hours old.

### 7.6 Search
- The MiniSearch index is built on the client from the cached bundle. It covers restaurant name, cuisine, dish name, and mod items (so "gf bun" finds dishes). Prefix matching plus fuzzy matching (edit distance 1 for terms of 4+ characters).
- **"Safe for person X" filter:** dish has a safe order for X ∧ not archived. Sort order: unflagged and fresh first, then stale, then uncovered-allergy warnings, then reaction-flagged last. Each result shows its badges so nothing is hidden silently.

---

## 8. Import / Export / Sharing

### 8.1 Export
- **JSON:** one file `safeorder-export-YYYY-MM-DD.json` with `{ format: "safeorder", version: 1, exported_at, household: {...}, profiles: [...], allergens (custom only + referenced presets by name), person_allergens, restaurants, locations, dishes, dish_allergens, safe_orders, modifications, meals, photos: [{id, dish_id, meal_id, storage_path}] }`. Photo binaries are **not** included in v1. A later version may add a ZIP with photos.
- **CSV:** `meals.csv` (one row per meal, flattened: date, person, restaurant, location, dish, mods as "; "-joined text, rating, outcome, price, notes), plus `safe_orders.csv` (person, restaurant, dish, mods, note, last verified, flag). Both are downloaded together in a ZIP built on the client with `fflate`.

### 8.2 Import (JSON)
- Validated with a Zod schema matching `version`. Unknown versions are rejected with a clear message.
- **Mode: Merge** (the only mode in v1):
  - Rows are matched by `id`. Rows that already exist are skipped unless the imported `updated_at` is newer, in which case they are updated.
  - Restaurants are also de-duplicated by case-insensitive name when the IDs differ, and the user is prompted: "3 restaurants match existing names: merge / keep both".
  - Profiles in the file are mapped to current household members through a mapping screen (match by display name, or choose a member or "skip this person's data").
  - Allergens are matched by name: presets by name, custom ones by name or created if missing.
- A preview is shown before committing ("Will add 12 restaurants, 40 dishes, 85 meals; update 3; skip 7"). The import runs as one transactional RPC (`import_bundle(jsonb)`), with a size cap of 5 MB.

### 8.3 Share links
- Created from Dish detail → Share. Options: include the person's name or show "Guest"; include the note (yes/no).
- `snapshot` contains: restaurant name, chain flag, location label (optional), dish name, the person's allergy list (names + kind), mods (rendered text + allergen names), note, `snapshot_at`, and dish archived state at the time.
- **Permanent until revoked.** The snapshot does **not** update automatically. Dish detail shows "Shared link is older than your current order. [Update link]", which replaces the snapshot and keeps the same token.
- Managed in Settings → Data → Share links: created date, views, last viewed, and actions to Copy, Update, or Revoke.
- Deleting the dish or safe order keeps the link working (the snapshot is self-contained) until it is revoked. The UI tells the user this when deleting.
- Uses the Web Share API when available, and falls back to copy-to-clipboard.

---

## 9. Edge Cases

| Case | Handling |
|---|---|
| The same dish name exists at two restaurants | No conflict; dishes are scoped to a restaurant. |
| Duplicate dish name at the same restaurant | Blocked (case-insensitive) unless the existing one is archived. Offer "Open existing". |
| Duplicate restaurant name | Allowed (two different "Taqueria"s), with a "Similar restaurant exists nearby/by name" hint at creation. |
| A dish varies by chain location | Use per-location notes. If it is truly different, create a separate dish ("Burrito (airport menu)"). |
| A person has no allergies set | Server card shows the order only and hides the "I have food allergies" header. Coverage panel shows "No allergies on profile". |
| A dish has no allergen tags | "Allergens not recorded" (grey), with a prompt to tag. Never green. |
| A mod is linked to an allergen the person doesn't have | Allowed (e.g. ordered for caution). Ignored in coverage. |
| Ordering for a partner who isn't present | Pick their tab or the person in the log flow; any member can do this. |
| Shared plate / meal for several people | v1: log a meal per person (the log flow offers "Also log for…" with multiple people, copying each person's own safe order). |
| Off-menu or custom order | Create a dish with the description "off-menu". |
| Restaurant closed permanently | Archive the restaurant; its history is kept. |
| Recipe changed (staff say the sauce now has nuts) | Add the allergen tag to the dish. Coverage warnings appear for affected people immediately. Optionally press "Confirmed with staff today" after updating the mods. |
| Meal logged at a past date (backfill) | The date picker allows any past date and no future dates. `last_verified_at` uses the meal date, not the created date. |
| Reaction later attributed to something else | Edit the meal's outcome. If the flag came from that meal, prompt to clear it. |
| Member removed from the household | Their profile leaves the household. Their safe orders and meals stay and display "Former member (name)". They lose access immediately (RLS). |
| Owner wants to leave | Must transfer ownership first, or delete the household if they are the sole member. |
| Account deletion | Edge Function: if the user is the owner with other members, ownership must be transferred first. The user's profile is anonymized ("Deleted user"), their meals and safe orders stay with the household, and the auth user is deleted. A sole member who deletes their account also deletes the household and its photos. |
| Magic link opened on a different device or browser | Supabase PKCE flow. The link works on the device where it was opened, and the original tab shows "Check your other device". |
| Magic link email delayed or in spam | "Didn't get it?" offers a resend after 60 s and a spam-folder hint. |
| GPS inaccurate indoors | Nearest-location auto-selection only within 300 m. The user can always change the location. |
| Offline at the restaurant, with no cached data yet (fresh install) | Show "Connect once to download your data". The server card can't work until the first sync, and onboarding says so. |
| Stale cache on a shared phone after sign-out | Sign-out clears the IndexedDB query cache, drafts, and in-memory signed URLs. |
| Two members edit the same safe order at once | Conflict detection (§7.3). |
| Very long mod lists on the server card | Font auto-shrinks to a 22 px minimum, then the card scrolls, with a "more below" indicator. |
| Currency | Per-meal `currency` defaults to the household's default (USD; editable in settings). There is no conversion and no totals across currencies. |
| Clock and timezone | `eaten_on` is a local date (no timezone). Staleness is calculated from local "today". |

---

## 10. Non-Goals (v1)

- Offline writes or a sync queue.
- Places/maps API integration, reverse geocoding, or map views.
- Ingredient databases, menu scraping, or AI allergen detection.
- Push notifications.
- Languages beyond English and Spanish, and machine translation of free text on the cards.
- Native apps (the PWA is installable on iOS and Android).
- Multiple households per user.
- Public reviews or social features beyond read-only share links.
- Spending analytics or charts.

---

## 11. Milestones

1. **Foundation:** Vite/React/TS scaffold, Supabase project, migrations + seed, RLS + pgTAP tests, magic-link auth, household create/invite/join, profile + allergy setup, disclaimer.
2. **Core logging:** restaurants/locations (chain support, GPS capture), dishes + allergen tags, safe orders + mod editor, meal logging with snapshot and update prompt, Home (search, recent, nearby), person filter.
3. **Safety UX:** server card (wake lock), chef card, coverage warnings, staleness badges, reaction flags and clearing, archive flows.
4. **Offline + PWA:** service worker, persisted query cache, offline banner and disabled writes, draft protection, install prompt, thumbnail caching.
5. **Media + portability:** photo upload/compress/thumbnail/orphan cleanup, JSON/CSV export, JSON import with preview and mapping, printable PDF chef card, share links + public view + management.
6. **Polish:** accessibility audit, Playwright e2e on iPhone/Pixel viewports, realtime refresh, conflict handling, empty states, performance budget (initial JS ≤ 200 KB gzipped, excluding the lazy PDF chunk; server card opens in under 300 ms from a cached state).

---

## 12. Acceptance Criteria (key flows)

- In airplane mode, after one prior sync, I can open the app, find a restaurant by typing three letters, and show the server card for my saved order.
- At a chain location I've never visited, I see my safe orders from other locations of that chain.
- Logging a meal with a changed mod asks whether to update my saved order, and both choices behave as described.
- Tagging an existing dish with "Peanut" immediately shows a red uncovered warning on my partner's safe order if they have a peanut allergy and no mod for it.
- Logging a "bad" outcome flags the dish red for that person only. The flag stays until it is cleared manually.
- A safe order not verified for more than 180 days shows "Re-confirm with staff".
- A share link opens on a logged-out phone, shows the snapshot, and shows "no longer available" after I revoke it.
- A user from household A cannot read any row or photo of household B (verified by pgTAP and by a storage policy test).
- Export, then import into a fresh household (with person mapping), reproduces all restaurants, dishes, safe orders, mods, and meals.

---

## 13. Open Questions

1. Default currency and locale: assume USD / en-US?
2. Should the server card offer a "show preferences too" toggle, or show only allergies always? (Current spec: allergies only on the dish card; preferences are optional on the chef card.)
3. Should the meal history window in the startup bundle (2 years) be configurable?
4. Hosting target, still to be decided. The spec is portable, but the choice affects the SPA fallback config and the share-link route (`/s/:token` must serve `index.html`).
5. App name: "SafeOrder" is a placeholder.
