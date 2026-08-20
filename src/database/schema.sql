-- FitRing Companion — authoritative database schema.
-- In dev, DB_SYNCHRONIZE=true creates this schema automatically from the entities;


create extension if not exists "pgcrypto";

create table users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  password_hash text not null,
  created_at    timestamptz not null default now()
);

create table devices (
  id          uuid primary key default gen_random_uuid(),
  external_id text not null unique,        -- vendor-facing id, e.g. "FITRING-001"
  name        text not null,
  user_id     uuid not null references users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table health_readings (
  id          uuid primary key default gen_random_uuid(),
  device_id   uuid not null references devices(id) on delete cascade,
  client_uuid uuid not null,               -- client-generated idempotency key
  heart_rate  int not null,
  spo2        int not null,
  steps       int not null,
  recorded_at timestamptz not null,
  created_at  timestamptz not null default now(),
  constraint uq_health_readings_device_client_uuid unique (device_id, client_uuid)
);
create index idx_health_readings_device_recorded_at on health_readings (device_id, recorded_at);

create table products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  price       numeric(10, 2) not null,
  image_url   text,
  created_at  timestamptz not null default now()
);

create table cart_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  quantity   int not null check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_cart_items_user_product unique (user_id, product_id)
);

create table orders (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  total_amount numeric(10, 2) not null,
  status       text not null default 'placed',
  created_at   timestamptz not null default now()
);

create table order_items (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references orders(id) on delete cascade,
  product_id uuid not null references products(id),
  quantity   int not null,
  unit_price numeric(10, 2) not null
);
