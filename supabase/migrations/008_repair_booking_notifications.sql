-- Compatibility repair for projects where booking_notifications was created
-- by an older schema without customer_id.
alter table public.booking_notifications
  add column if not exists customer_id uuid references public.customers(id) on delete cascade;

update public.booking_notifications n
set customer_id = b.customer_id
from public.bookings b
where n.booking_id = b.id
  and n.customer_id is null;

notify pgrst, 'reload schema';
