create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  nick text not null unique,
  real_name text not null,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  avatar_url text
);

create table if not exists characters (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users(id) on delete cascade,
  name text not null default 'Ficha',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tables (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users(id) on delete cascade,
  name text not null,
  invite_code char(5) not null unique,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists table_members (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references tables(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null check (role in ('master', 'player', 'master_player')),
  character_id uuid references characters(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (table_id, user_id)
);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references tables(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  character_id uuid references characters(id) on delete set null,
  channel text not null check (channel in ('conversation', 'rolls', 'system')),
  message text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists initiative_entries (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references tables(id) on delete cascade,
  character_id uuid references characters(id) on delete cascade,
  name text not null,
  value integer not null default 0,
  manual boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists inventory_items (
  id uuid primary key default gen_random_uuid(),
  character_id uuid references characters(id) on delete cascade,
  table_id uuid references tables(id) on delete cascade,
  location text not null default 'character',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists shop_items (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references tables(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists transformations (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references characters(id) on delete cascade,
  name text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_characters_owner on characters(owner_id);
create index if not exists idx_table_members_user on table_members(user_id);
create index if not exists idx_table_members_table on table_members(table_id);
create index if not exists idx_chat_messages_table on chat_messages(table_id, created_at);
