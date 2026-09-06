-- Compatibility repair for the legacy required booking_notifications.code column.
create or replace function public.fill_booking_notification_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.code is null then
    select b.code into new.code
    from public.bookings b
    where b.id = new.booking_id;
  end if;
  return new;
end;
$$;

drop trigger if exists booking_notification_fill_code on public.booking_notifications;
create trigger booking_notification_fill_code
before insert on public.booking_notifications
for each row execute function public.fill_booking_notification_code();

notify pgrst, 'reload schema';
