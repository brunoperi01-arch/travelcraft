-- ════════════════════════════════════════════════════════════
-- TravelCraft — Schéma Supabase MVP (v1)
-- Région recommandée : eu-central (Francfort) ou eu-west (RGPD)
-- À exécuter dans SQL Editor > New query
-- ════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ── 1. CLIENTS ─────────────────────────────────────────────
-- RGPD : food_preferences / allergies = données potentiellement
-- sensibles (art. 9). Jamais exposées côté public (cf. RLS).
create table clients (
  id               uuid primary key default gen_random_uuid(),
  first_name       text not null,
  last_name        text not null,
  email            text,
  phone            text,
  travel_style     text,                 -- ex: "slow travel, authentique"
  budget_level     text,                 -- eco | confort | premium | luxe
  food_preferences text,
  allergies        text,
  pace             text,                 -- detendu | equilibre | intense
  interests        text[],               -- ['gastronomie','vue','musee']
  dislikes         text[],
  notes            text,
  created_at       timestamptz not null default now()
);

-- ── 2. TRIPS ───────────────────────────────────────────────
create table trips (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references clients(id) on delete cascade,
  destination      text not null,
  title            text,
  start_date       date,
  end_date         date,
  number_of_people int default 2,
  status           text not null default 'draft',   -- draft | ready | delivered
  public_slug      text unique not null,
  is_published     boolean not null default false,
  created_at       timestamptz not null default now()
);
create index idx_trips_slug on trips(public_slug);
create index idx_trips_client on trips(client_id);

-- ── 3. TRIP_DAYS ───────────────────────────────────────────
create table trip_days (
  id             uuid primary key default gen_random_uuid(),
  trip_id        uuid not null references trips(id) on delete cascade,
  day_number     int not null,
  title          text,
  quote          text,        -- sous-titre émotionnel
  mood           text,
  morning        text,
  afternoon      text,
  evening        text,
  restaurant     text,
  local_gem      text,
  practical_tip  text,
  created_at     timestamptz not null default now(),
  unique (trip_id, day_number)
);
create index idx_days_trip on trip_days(trip_id);

-- ── 4. PLACES (référentiel réutilisable entre voyages) ─────
create table places (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  type                text,             -- restaurant|vue|balade|musee|bar|pepite
  address             text,
  district            text,
  latitude            double precision,
  longitude           double precision,
  description         text,
  price_level         text,
  booking_required    boolean default false,
  website             text,
  notes               text,
  verification_status text not null default 'ia',  -- ia | verifie | a_revoir
  last_verified_at    timestamptz,
  created_at          timestamptz not null default now()
);
create index idx_places_name on places(lower(name));

-- ── 5. TRIP_DAY_PLACES (liaison ordonnée) ──────────────────
create table trip_day_places (
  id                         uuid primary key default gen_random_uuid(),
  trip_day_id                uuid not null references trip_days(id) on delete cascade,
  place_id                   uuid not null references places(id) on delete cascade,
  moment                     text not null default 'matin', -- matin|am|soir|table|pepite
  order_index                int not null default 1,
  custom_note                text,
  estimated_duration_minutes int,
  created_at                 timestamptz not null default now()
);
create index idx_tdp_day on trip_day_places(trip_day_id);

-- ── 6. CLIENT_FEEDBACK ─────────────────────────────────────
create table client_feedback (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid references clients(id) on delete cascade,
  trip_id      uuid not null references trips(id) on delete cascade,
  trip_day_id  uuid references trip_days(id) on delete set null,
  place_id     uuid references places(id) on delete set null,
  rating       int check (rating between 1 and 5),
  liked        boolean,
  comment      text,
  tags         text[],
  created_at   timestamptz not null default now()
);
create index idx_fb_trip on client_feedback(trip_id);

-- ── 7. KNOWLEDGE_BASE (préparée, non utilisée par le MVP) ──
create table knowledge_base (
  id               uuid primary key default gen_random_uuid(),
  destination      text not null,
  category         text,
  title            text,
  content          text,
  source           text,
  confidence_score numeric(3,2) default 0.50,
  last_verified_at timestamptz,
  created_at       timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════
-- RLS — Row Level Security
-- Principe : authenticated (toi, admin) = tout.
--            anon (client via slug) = lecture des voyages
--            PUBLIÉS uniquement + insertion de feedback.
--            La table clients n'est JAMAIS lisible en anon.
-- ════════════════════════════════════════════════════════════
alter table clients          enable row level security;
alter table trips            enable row level security;
alter table trip_days        enable row level security;
alter table places           enable row level security;
alter table trip_day_places  enable row level security;
alter table client_feedback  enable row level security;
alter table knowledge_base   enable row level security;

-- Admin authentifié : accès complet partout
create policy "admin all clients"   on clients         for all to authenticated using (true) with check (true);
create policy "admin all trips"     on trips           for all to authenticated using (true) with check (true);
create policy "admin all days"      on trip_days       for all to authenticated using (true) with check (true);
create policy "admin all places"    on places          for all to authenticated using (true) with check (true);
create policy "admin all tdp"       on trip_day_places for all to authenticated using (true) with check (true);
create policy "admin all feedback"  on client_feedback for all to authenticated using (true) with check (true);
create policy "admin all kb"        on knowledge_base  for all to authenticated using (true) with check (true);

-- Public (anon) : lecture seule, voyages publiés uniquement
create policy "public read published trips" on trips
  for select to anon using (is_published = true);

create policy "public read days of published trips" on trip_days
  for select to anon using (
    exists (select 1 from trips t where t.id = trip_id and t.is_published)
  );

create policy "public read linked places" on trip_day_places
  for select to anon using (
    exists (
      select 1 from trip_days d join trips t on t.id = d.trip_id
      where d.id = trip_day_id and t.is_published
    )
  );

create policy "public read places of published trips" on places
  for select to anon using (
    exists (
      select 1 from trip_day_places l
      join trip_days d on d.id = l.trip_day_id
      join trips t on t.id = d.trip_id
      where l.place_id = places.id and t.is_published
    )
  );

-- Public : insertion de feedback sur un voyage publié uniquement
create policy "public insert feedback on published trips" on client_feedback
  for insert to anon with check (
    exists (select 1 from trips t where t.id = trip_id and t.is_published)
  );

-- NOTE volontaire : aucune policy anon sur `clients` ni `knowledge_base`
-- → invisibles publiquement, même avec le slug.
