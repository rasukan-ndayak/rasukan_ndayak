-- Add composite Fullset products without changing existing product or booking history.
alter type public.product_category add value if not exists 'Fullset';

alter table public.products
  add column if not exists components jsonb not null default '[]'::jsonb;

create or replace view public.product_availability as
select
  p.id,
  p.name,
  p.category,
  p.unit,
  p.price,
  p.stock,
  p.image_url,
  p.description,
  p.details,
  p.created_at,
  p.updated_at,
  p.active,
  p.components
from public.products p;
