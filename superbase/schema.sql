-- ======================================================
-- 1. NETTOYAGE : On supprime les tables existantes (dans le bon ordre pour éviter les conflits de clés étrangères)
-- ======================================================
DROP TABLE IF EXISTS invoice_lines CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS quote_lines CASCADE;
DROP TABLE IF EXISTS quotes CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP SEQUENCE IF EXISTS product_reference_seq;
DROP SEQUENCE IF EXISTS customer_code_seq;
DROP SEQUENCE IF EXISTS invoice_number_seq;
DROP SEQUENCE IF EXISTS quote_number_seq;

create sequence product_reference_seq start with 1 increment by 1;
create sequence customer_code_seq start with 1 increment by 1;
create sequence invoice_number_seq start with 1 increment by 1;
create sequence quote_number_seq start with 1 increment by 1;

create or replace function next_product_reference()
returns text
language sql
as $$
  select 'PRD-' || lpad(nextval('product_reference_seq')::text, 6, '0');
$$;

create or replace function next_customer_code()
returns text
language sql
as $$
  select 'CLI-' || lpad(nextval('customer_code_seq')::text, 6, '0');
$$;

create or replace function next_invoice_number()
returns text
language sql
as $$
  select 'FAC-' || lpad(nextval('invoice_number_seq')::text, 6, '0');
$$;

create or replace function next_quote_number()
returns text
language sql
as $$
  select 'DEV-' || lpad(nextval('quote_number_seq')::text, 6, '0');
$$;

-- ======================================================
-- 2. CRÉATION DES TABLES
-- ======================================================

-- Catégories
create table categories (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  created_at timestamptz default now()
);

-- Produits
create table products (
  id uuid default gen_random_uuid() primary key,
  reference text unique not null default next_product_reference(),
  name text not null,
  category_id uuid references categories(id) on delete set null,
  purchase_price numeric(10,2) not null default 0,
  selling_price numeric(10,2) not null default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Clients
create table customers (
  id uuid default gen_random_uuid() primary key,
  code text unique not null default next_customer_code(),
  name text not null,
  phone text,
  segment text default 'particulier',
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Factures
create table invoices (
  id uuid default gen_random_uuid() primary key,
  invoice_number text unique not null default next_invoice_number(),
  customer_id uuid references customers(id) on delete set null,
  invoice_date date not null default current_date,
  status text default 'emise', -- brouillon, emise, payee, annulee
  payment_methods text[] not null default '{}',
  total_amount numeric(10,2) default 0,
  user_id uuid references auth.users(id) default auth.uid(),
  created_at timestamptz default now()
);

-- Lignes de Facture
create table invoice_lines (
  id uuid default gen_random_uuid() primary key,
  invoice_id uuid references invoices(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  quantity int not null default 1,
  unit_price numeric(10,2) not null,
  total_price numeric(10,2) not null
);

-- Devis
create table quotes (
  id uuid default gen_random_uuid() primary key,
  quote_number text unique not null default next_quote_number(),
  customer_id uuid references customers(id) on delete set null,
  quote_date date not null default current_date,
  buyer text,
  due_date date,
  structure_name text,
  range_name text,
  product_name text,
  dominant_colors text,
  additional_info text,
  logo_price numeric(10,2) not null default 0,
  discount numeric(10,2) not null default 0,
  subtotal numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  user_id uuid references auth.users(id) default auth.uid(),
  created_at timestamptz default now()
);

-- Lignes de devis
create table quote_lines (
  id uuid default gen_random_uuid() primary key,
  quote_id uuid references quotes(id) on delete cascade,
  line_type text not null, -- articles, containers, packaging_prints, labels, mockups, logo
  label text,
  quantity int not null default 1,
  unit_price numeric(10,2) not null default 0,
  total_price numeric(10,2) not null default 0
);

-- ======================================================
-- 3. SÉCURITÉ (Row Level Security)
-- ======================================================

-- Politiques (Seuls les utilisateurs connectés peuvent gérer les données)
create policy "Authenticated can manage categories" on categories for all using (auth.role() = 'authenticated');
create policy "Authenticated can manage products" on products for all using (auth.role() = 'authenticated');
create policy "Authenticated can manage customers" on customers for all using (auth.role() = 'authenticated');
create policy "Authenticated can manage invoices" on invoices for all using (auth.role() = 'authenticated');
create policy "Authenticated can manage invoice lines" on invoice_lines for all using (auth.role() = 'authenticated');
create policy "Authenticated can manage quotes" on quotes for all using (auth.role() = 'authenticated');
create policy "Authenticated can manage quote lines" on quote_lines for all using (auth.role() = 'authenticated');

-- ======================================================
-- 4. DONNÉES DE TEST (Seed)
-- ======================================================
INSERT INTO categories (name) VALUES ('Maquillage'), ('Soins'), ('Parfums');
