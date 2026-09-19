-- Mason Homes Inventory Tracker — schema + seed.
-- Run once in the Supabase SQL editor. Safe to re-run (idempotent tables);
-- the seed block only runs when the units table is empty.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- TABLES
-- ---------------------------------------------------------------------------

-- UNITS: one row per property line in the spec's reference tables. A property
-- with a shared par is a single row (name "... (all units)"); specific units
-- (Riviera 105/203/208, the 616 house) are their own rows.
create table if not exists units (
  unit_id              uuid primary key default gen_random_uuid(),
  name                 text not null,                  -- "Riviera 105"
  property_name        text not null,                  -- "Riviera" (grouping)
  sort                 int  not null default 0,
  parking_pass_label   text not null default 'None',   -- None | 1 pass | 2 passes | Card
  has_parking_pass     boolean not null default false, -- false when label is None
  parking_status       text not null default 'na',     -- ok | missing | na
  parking_confirmed_at timestamptz,
  last_cleaned_at      timestamptz,
  turnover_frequency   int,                            -- turnovers/week; null = global default
  -- Bagged bedding, kept in the closet rather than made up on the bed. Neither
  -- is inferable from linen sizes (a queen main bed and a standing twin carry
  -- the same ones), so both are tracked.
  -- Pullout: queen sheets, 1 queen quilt, 2 queen pillowcases.
  has_pullout          boolean not null default false,
  -- Per rollaway: twin sheets, 1 twin quilt, 1 queen pillowcase.
  rollaway_beds        int     not null default 0,
  -- Hostaway listing id, linking this unit to the master units list in the
  -- Ops database (core.units). Nullable; Par itself does not read it yet.
  hostaway_listing_id  text,
  -- Set when a unit leaves the portfolio: hidden from every list, history kept.
  retired_at           timestamptz,
  created_at           timestamptz not null default now()
);
create unique index if not exists units_hostaway_listing_id_key
  on units (hostaway_listing_id) where hostaway_listing_id is not null;

-- Global inputs that drive the calculated par math (single row).
create table if not exists settings (
  id                         int primary key default 1,
  default_turnover_frequency int     not null default 3,
  buffer_turnovers           int     not null default 1,
  central_buffer             numeric not null default 2,
  last_digest_at             timestamptz,                -- when the Slack summary last posted
  updated_at                 timestamptz not null default now(),
  constraint settings_singleton check (id = 1)
);
insert into settings (id) values (1) on conflict (id) do nothing;

-- Team accounts for invite-link login + roles (admin / cleaner).
create table if not exists app_users (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  phone         text unique,
  email         text,
  role          text not null default 'cleaner' check (role in ('admin','cleaner')),
  status        text not null default 'active'  check (status in ('active','disabled')),
  invite_token  text unique not null default encode(gen_random_bytes(16), 'hex'),
  onboarded     boolean not null default false,
  created_at    timestamptz not null default now(),
  last_login_at timestamptz,
  password_hash text          -- scrypt hash; null until the user sets a password
);
create index if not exists app_users_invite_idx on app_users (invite_token);

-- Audit trail of manual stock changes (central counts/targets, linen edits).
create table if not exists stock_audit (
  id        uuid primary key default gen_random_uuid(),
  at        timestamptz not null default now(),
  actor     text not null default 'Unknown',
  action    text not null,
  item      text,
  unit_name text,
  detail    text
);
create index if not exists stock_audit_at_idx on stock_audit (at desc);
alter table stock_audit enable row level security;

-- CONSUMABLE PAR: per unit, per item. current_actual is the cleaner's signal.
-- par = leave_behind * 4; reorder_point = one leave_behind.
create table if not exists consumable_par (
  id             uuid primary key default gen_random_uuid(),
  unit_id        uuid not null references units(unit_id) on delete cascade,
  item_name      text not null,
  sort           int  not null default 0,
  leave_behind   int  not null,
  closet_par     int  not null,
  reorder_point  int  not null,
  current_actual int  not null,
  fixed_par      boolean not null default false, -- bulk supply: par set, not calculated
  updated_at     timestamptz not null default now(),
  unique (unit_id, item_name)
);

-- LINEN PAR: per unit, per type. Should stay flat; actual < par signals loss.
create table if not exists linen_par (
  id             uuid primary key default gen_random_uuid(),
  unit_id        uuid not null references units(unit_id) on delete cascade,
  linen_type     text not null,  -- towels + sized bedding (see lib/constants LINEN_TYPES)
  sort           int  not null default 0,
  par_count      int  not null,
  current_actual int  not null,
  updated_at     timestamptz not null default now(),
  unique (unit_id, linen_type)
);

-- CENTRAL RESERVE: bulk backup for consumables and linens. For consumables,
-- item_name matches consumable_par.item_name. For linens, item_name is the
-- linen_type key.
create table if not exists central_reserve (
  id               uuid primary key default gen_random_uuid(),
  item_name        text not null,
  category         text not null,            -- consumable | linen
  sort             int  not null default 0,
  quantity_on_hand int  not null default 0,
  reorder_point    int  not null default 0,  -- when to buy more bulk
  par_level        int  not null default 0,  -- target bulk level; buy up to this
  fixed_par        boolean not null default false, -- bulk supply: targets set by hand
  updated_at       timestamptz not null default now(),
  unique (item_name, category)
);

-- CENTRAL PULL LOG: every movement from central. The anti-theft backbone.
create table if not exists central_pull_log (
  id                  uuid primary key default gen_random_uuid(),
  pulled_at           timestamptz not null default now(),
  staff_name          text not null,
  item_name           text not null,
  category            text not null,           -- consumable | linen
  quantity            int  not null,
  destination_unit_id uuid references units(unit_id) on delete set null,
  destination_name    text,                    -- snapshot so the audit trail survives unit edits
  reason              text not null            -- weekly_restock | damage_replacement | stain_out
);

-- CLEAN LOG: a record of each completed clean (who, when, parking + linens ok).
create table if not exists clean_log (
  id           uuid primary key default gen_random_uuid(),
  completed_at timestamptz not null default now(),
  unit_id      uuid references units(unit_id) on delete cascade,
  staff_name   text,
  parking_ok   boolean,
  linens_ok    boolean,
  flagged_items text[] not null default '{}'   -- consumables flagged on this clean
);

create index if not exists consumable_par_unit_idx on consumable_par (unit_id);
create index if not exists linen_par_unit_idx       on linen_par (unit_id);
create index if not exists pull_log_pulled_idx      on central_pull_log (pulled_at desc);
create index if not exists clean_log_unit_idx       on clean_log (unit_id, completed_at desc);

-- Lock the tables down. The app uses the service-role key (which bypasses RLS),
-- so enabling RLS with no policies keeps anon/auth clients out entirely.
alter table units             enable row level security;
alter table consumable_par    enable row level security;
alter table linen_par         enable row level security;
alter table central_reserve   enable row level security;
alter table central_pull_log  enable row level security;
alter table clean_log         enable row level security;
alter table settings          enable row level security;
alter table app_users         enable row level security;

-- ---------------------------------------------------------------------------
-- FUNCTIONS (atomic inventory movements)
-- ---------------------------------------------------------------------------

-- Log a single pull from central: write the log row, draw down the reserve,
-- and restore the destination unit's item to par.
create or replace function log_pull(
  p_staff    text,
  p_item     text,
  p_category text,
  p_qty      int,
  p_unit     uuid,
  p_reason   text
) returns void
language plpgsql
set search_path = public
as $$
declare
  v_unit_name text;
begin
  select name into v_unit_name from units where unit_id = p_unit;

  update central_reserve
     set quantity_on_hand = greatest(0, quantity_on_hand - p_qty),
         updated_at = now()
   where item_name = p_item and category = p_category;

  if p_category = 'consumable' then
    update consumable_par
       set current_actual = closet_par, updated_at = now()
     where unit_id = p_unit and item_name = p_item;
  elsif p_category = 'linen' then
    update linen_par
       set current_actual = par_count, updated_at = now()
     where unit_id = p_unit and linen_type = p_item;
  end if;

  insert into central_pull_log
    (staff_name, item_name, category, quantity, destination_unit_id, destination_name, reason)
  values
    (p_staff, p_item, p_category, p_qty, p_unit, v_unit_name, p_reason);
end;
$$;

-- (restock_unit used to live here. The weekly refill now runs in the app —
-- app/api/restock/route.ts — so it can pull only what the Stockroom has and
-- leave the remainder on the run. Existing databases keep the old function;
-- nothing calls it.)

-- Recompute calculated par from the inputs. Skips linens (stored) and bulk
-- supplies (fixed_par = true — their par/reorder are set directly).
create or replace function recalc_par() returns void
language plpgsql
set search_path = public
as $$
declare
  s record;
begin
  select * into s from settings where id = 1;
  update consumable_par cp
     set closet_par    = cp.leave_behind * (coalesce(u.turnover_frequency, s.default_turnover_frequency) + s.buffer_turnovers),
         reorder_point = cp.leave_behind * s.buffer_turnovers,
         updated_at    = now()
    from units u where u.unit_id = cp.unit_id and cp.fixed_par = false;
  update central_reserve cr
     set par_level     = round(sub.weekly_total * s.central_buffer)::int,
         reorder_point = sub.weekly_total,
         updated_at    = now()
    from (
      select cp.item_name,
             sum(cp.leave_behind * coalesce(u.turnover_frequency, s.default_turnover_frequency))::int as weekly_total
      from consumable_par cp join units u on u.unit_id = cp.unit_id
      where cp.fixed_par = false
      group by cp.item_name
    ) sub
   where cr.category = 'consumable' and cr.item_name = sub.item_name;
end;
$$;

-- ---------------------------------------------------------------------------
-- SEED (only when empty)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from units) then
    return;
  end if;

  -- Units — every active listing by internal name (from the listings export).
  insert into units (name, property_name, sort, parking_pass_label, has_parking_pass, parking_status) values
    ('616 58th St S', '616 58th St S', 1, 'None', false, 'na'),
    ('Art House 101', 'Art House', 2, 'None', false, 'na'),
    ('Art House 102', 'Art House', 3, 'None', false, 'na'),
    ('Artisan 303', 'Artisan', 4, 'None', false, 'na'),
    ('Artisan 321', 'Artisan', 5, 'None', false, 'na'),
    ('Artisan 408', 'Artisan', 6, 'None', false, 'na'),
    ('Artisan 429', 'Artisan', 7, 'None', false, 'na'),
    ('Citizen 201', 'Citizen', 8, 'None', false, 'na'),
    ('Citizen 202', 'Citizen', 9, 'None', false, 'na'),
    ('Citizen 203', 'Citizen', 10, 'None', false, 'na'),
    ('Citizen 204', 'Citizen', 11, 'None', false, 'na'),
    ('Citizen 205', 'Citizen', 12, 'None', false, 'na'),
    ('Citizen 206', 'Citizen', 13, 'None', false, 'na'),
    ('Citizen 207', 'Citizen', 14, 'None', false, 'na'),
    ('Citizen 208', 'Citizen', 15, 'None', false, 'na'),
    ('Citizen 209', 'Citizen', 16, 'None', false, 'na'),
    ('Citizen 210', 'Citizen', 17, 'None', false, 'na'),
    ('Citizen 211', 'Citizen', 18, 'None', false, 'na'),
    ('Citizen 212', 'Citizen', 19, 'None', false, 'na'),
    ('Citizen 213', 'Citizen', 20, 'None', false, 'na'),
    ('Citizen 214', 'Citizen', 21, 'None', false, 'na'),
    ('Citizen 215', 'Citizen', 22, 'None', false, 'na'),
    ('Citizen 216', 'Citizen', 23, 'None', false, 'na'),
    ('Citizen 217', 'Citizen', 24, 'None', false, 'na'),
    ('Citizen 218', 'Citizen', 25, 'None', false, 'na'),
    ('Citizen 219', 'Citizen', 26, 'None', false, 'na'),
    ('Citizen 220', 'Citizen', 27, 'None', false, 'na'),
    ('Citizen 221', 'Citizen', 28, 'None', false, 'na'),
    ('Citizen 222', 'Citizen', 29, 'None', false, 'na'),
    ('Citizen 223', 'Citizen', 30, 'None', false, 'na'),
    ('Citizen 224', 'Citizen', 31, 'None', false, 'na'),
    ('Citizen 225', 'Citizen', 32, 'None', false, 'na'),
    ('Citizen 226', 'Citizen', 33, 'None', false, 'na'),
    ('Citizen 227', 'Citizen', 34, 'None', false, 'na'),
    ('Citizen 228', 'Citizen', 35, 'None', false, 'na'),
    ('Citizen 301', 'Citizen', 36, 'None', false, 'na'),
    ('Citizen 302', 'Citizen', 37, 'None', false, 'na'),
    ('Citizen 303', 'Citizen', 38, 'None', false, 'na'),
    ('Citizen 304', 'Citizen', 39, 'None', false, 'na'),
    ('Citizen 305', 'Citizen', 40, 'None', false, 'na'),
    ('Citizen 306', 'Citizen', 41, 'None', false, 'na'),
    ('Citizen 307', 'Citizen', 42, 'None', false, 'na'),
    ('Citizen 308', 'Citizen', 43, 'None', false, 'na'),
    ('Citizen 309', 'Citizen', 44, 'None', false, 'na'),
    ('Citizen 310', 'Citizen', 45, 'None', false, 'na'),
    ('Citizen 311', 'Citizen', 46, 'None', false, 'na'),
    ('Clairview 5', 'Clairview', 47, '2 passes', true, 'ok'),
    ('Clairview 7', 'Clairview', 48, '2 passes', true, 'ok'),
    ('Forest Park 6', 'Forest Park', 49, '1 pass', true, 'ok'),
    ('Forest Park 12', 'Forest Park', 50, '1 pass', true, 'ok'),
    ('Highland 1209 H', 'Highland', 51, '1 pass', true, 'ok'),
    ('Highland 1209 I', 'Highland', 52, '1 pass', true, 'ok'),
    ('Highland 1213 H', 'Highland', 53, '1 pass', true, 'ok'),
    ('Highland 1213 I', 'Highland', 54, '1 pass', true, 'ok'),
    ('Highland 1213 J', 'Highland', 55, '1 pass', true, 'ok'),
    ('Highland 1217 B', 'Highland', 56, '1 pass', true, 'ok'),
    ('Highland 1217 C', 'Highland', 57, '1 pass', true, 'ok'),
    ('Highland 1217 J', 'Highland', 58, '1 pass', true, 'ok'),
    ('Highland 1221 J', 'Highland', 59, '1 pass', true, 'ok'),
    ('Lenox Park 9205', 'Lenox Park', 60, 'None', false, 'na'),
    ('Riviera 105', 'Riviera', 61, '2 passes', true, 'ok'),
    ('Riviera 203', 'Riviera', 62, '1 pass', true, 'ok'),
    ('Riviera 208', 'Riviera', 63, '1 pass', true, 'ok'),
    -- Added after launch: Frank (Jul 2026) and the four from the master list (Sep 2026).
    ('Frank 405', 'Frank', 51, '1 pass', true, 'ok'),
    ('Frank 512', 'Frank', 52, '1 pass', true, 'ok'),
    ('Frank 812', 'Frank', 53, '1 pass', true, 'ok'),
    ('Art House 201', 'Art House', 3, 'None', false, 'na'),
    ('Waites 205', 'Waites', 57, 'None', false, 'na'),
    ('Waites 206', 'Waites', 58, 'None', false, 'na'),
    ('Waites 401', 'Waites', 59, 'None', false, 'na');

  -- Consumable par — same tier for every unit. current_actual starts at par.
  insert into consumable_par (unit_id, item_name, sort, leave_behind, closet_par, reorder_point, current_actual, fixed_par)
  select u.unit_id, c.item_name, c.sort, c.leave_behind, c.closet_par, c.reorder_point, c.closet_par, c.fixed_par
  from units u
  cross join (values
    ('Kitchen trash bags',   1, 3, 12, 3, false),
    ('Paper towel',          2, 2,  8, 2, false),
    ('Dishwasher pods',      3, 3, 12, 3, false),
    ('Laundry pods',         4, 5, 20, 5, false),
    ('Bathroom trash bags',  5, 3, 12, 3, false),
    ('Toilet paper',         6, 3, 12, 3, false),
    ('Coffee pods',          7, 5, 20, 5, false),
    ('Creamer',              8, 5, 20, 5, false),
    ('Sponges',              9, 1,  4, 1, false),
    -- Bulk supplies: one jug lives in the closet; par is set, not calculated.
    ('Dawn',                10, 0,  1, 0, true),
    ('Conditioner',         11, 0,  1, 0, true),
    ('3-in-1',              12, 0,  1, 0, true)
  ) as c(item_name, sort, leave_behind, closet_par, reorder_point, fixed_par);

  -- Linen par — per unit. Spec profiles where the building is known; new
  -- buildings (Citizen, Lenox Park) default to 4/4/1/1/1, tunable later.
  insert into linen_par (unit_id, linen_type, sort, par_count, current_actual)
  select u.unit_id, t.linen_type, t.sort,
    case t.linen_type when 'bath_towel' then p.bath when 'washcloth' then p.wash
      when 'hand_towel' then p.hand when 'makeup_towel' then p.mk else p.kit end,
    case t.linen_type when 'bath_towel' then p.bath when 'washcloth' then p.wash
      when 'hand_towel' then p.hand when 'makeup_towel' then p.mk else p.kit end
  from units u
  join (values
    ('616 58th St S',7,7,1,1,1),
    ('Art House 101',5,5,2,2,1),('Art House 102',5,5,2,2,1),
    ('Artisan 303',4,4,1,1,1),('Artisan 321',4,4,1,1,1),('Artisan 408',4,4,1,1,1),('Artisan 429',4,4,1,1,1),
    ('Citizen 201',4,4,1,1,1),('Citizen 202',4,4,1,1,1),('Citizen 203',4,4,1,1,1),('Citizen 204',4,4,1,1,1),
    ('Citizen 205',4,4,1,1,1),('Citizen 206',4,4,1,1,1),('Citizen 207',4,4,1,1,1),('Citizen 208',4,4,1,1,1),
    ('Citizen 209',4,4,1,1,1),('Citizen 210',4,4,1,1,1),('Citizen 211',4,4,1,1,1),('Citizen 212',4,4,1,1,1),
    ('Citizen 213',4,4,1,1,1),('Citizen 214',4,4,1,1,1),('Citizen 215',4,4,1,1,1),('Citizen 216',4,4,1,1,1),
    ('Citizen 217',4,4,1,1,1),('Citizen 218',4,4,1,1,1),('Citizen 219',4,4,1,1,1),('Citizen 220',4,4,1,1,1),
    ('Citizen 221',4,4,1,1,1),('Citizen 222',4,4,1,1,1),('Citizen 223',4,4,1,1,1),('Citizen 224',4,4,1,1,1),
    ('Citizen 225',4,4,1,1,1),('Citizen 226',4,4,1,1,1),('Citizen 227',4,4,1,1,1),('Citizen 228',4,4,1,1,1),
    ('Citizen 301',4,4,1,1,1),('Citizen 302',4,4,1,1,1),('Citizen 303',4,4,1,1,1),('Citizen 304',4,4,1,1,1),
    ('Citizen 305',4,4,1,1,1),('Citizen 306',4,4,1,1,1),('Citizen 307',4,4,1,1,1),('Citizen 308',4,4,1,1,1),
    ('Citizen 309',4,4,1,1,1),('Citizen 310',4,4,1,1,1),('Citizen 311',4,4,1,1,1),
    ('Clairview 5',5,5,2,2,1),('Clairview 7',5,5,2,2,1),
    ('Forest Park 6',4,4,1,1,1),('Forest Park 12',4,4,1,1,1),
    ('Highland 1209 H',4,4,1,1,1),('Highland 1209 I',4,4,1,1,1),('Highland 1213 H',4,4,1,1,1),
    ('Highland 1213 I',4,4,1,1,1),('Highland 1213 J',4,4,1,1,1),('Highland 1217 B',4,4,1,1,1),
    ('Highland 1217 C',4,4,1,1,1),('Highland 1217 J',4,4,1,1,1),('Highland 1221 J',4,4,1,1,1),
    ('Lenox Park 9205',4,4,1,1,1),
    ('Riviera 105',5,5,2,2,1),('Riviera 203',4,4,1,1,1),('Riviera 208',4,4,1,1,1),
    ('Frank 405',4,4,1,1,1),('Frank 512',4,4,1,1,1),('Frank 812',4,4,1,1,1),
    ('Art House 201',5,5,2,2,1),('Waites 205',4,4,1,1,1),('Waites 206',4,4,1,1,1),('Waites 401',5,5,2,2,1)
  ) as p(name,bath,wash,hand,mk,kit) on p.name = u.name
  cross join (values ('bath_towel',1),('washcloth',2),('hand_towel',3),('makeup_towel',4),('kitchen_towel',5)) as t(linen_type,sort);

  -- Central reserve. Bulk levels for a 63-unit portfolio: par ~ one week of
  -- full restock (leave-behind x 3 turnovers x 63 units). Replace on-hand with
  -- real counts on the Central screen.
  insert into central_reserve (item_name, category, sort, quantity_on_hand, reorder_point, par_level) values
    ('Kitchen trash bags',  'consumable', 1, 570, 190, 570),
    ('Paper towel',         'consumable', 2, 380, 130, 380),
    ('Dishwasher pods',     'consumable', 3, 570, 190, 570),
    ('Laundry pods',        'consumable', 4, 950, 320, 950),
    ('Bathroom trash bags', 'consumable', 5, 570, 190, 570),
    ('Toilet paper',        'consumable', 6, 570, 190, 570),
    ('Coffee pods',         'consumable', 7, 950, 320, 950),
    ('Creamer',             'consumable', 8, 950, 320, 950),
    ('Sponges',             'consumable', 9, 190,  63, 190),
    ('bath_towel',          'linen',      9, 40,  12,  40),
    ('washcloth',           'linen',     10, 40,  12,  40),
    ('hand_towel',          'linen',     11, 20,   6,  20),
    ('makeup_towel',        'linen',     12, 20,   6,  20),
    ('kitchen_towel',       'linen',     13, 15,   5,  15),
    -- Sized bedding. Start empty; managers set bulk levels and assign which
    -- units carry King vs Queen in the linen editor.
    ('fitted_sheet_queen',  'linen',     14,  0,   8,  24),
    ('fitted_sheet_king',   'linen',     15,  0,   8,  24),
    ('flat_sheet_queen',    'linen',     16,  0,   8,  24),
    ('flat_sheet_king',     'linen',     17,  0,   8,  24),
    ('quilt_queen',         'linen',     18,  0,   4,  12),
    ('quilt_king',          'linen',     19,  0,   4,  12),
    ('pillowcase_queen',    'linen',     20,  0,  16,  48),
    ('pillowcase_king',     'linen',     21,  0,  16,  48),
    ('fitted_sheet_twin',   'linen',     22,  0,   8,  24),
    ('flat_sheet_twin',     'linen',     23,  0,   8,  24),
    ('quilt_twin',          'linen',     24,  0,   4,  12);

  -- Bulk supplies (jugs, not per-turnover): targets set by hand, never recalced.
  insert into central_reserve (item_name, category, sort, quantity_on_hand, reorder_point, par_level, fixed_par) values
    ('Dawn',        'consumable', 10, 0, 4, 12, true),
    ('Conditioner', 'consumable', 11, 0, 4, 12, true),
    ('3-in-1',      'consumable', 12, 0, 4, 12, true);

  -- Compute calculated consumable par + central targets from the inputs.
  -- Frank's three units keep a queen pullout couch (bedding bagged in the closet).
  update units set has_pullout = true where name in ('Frank 405', 'Frank 512', 'Frank 812');

  perform recalc_par();
end $$;
