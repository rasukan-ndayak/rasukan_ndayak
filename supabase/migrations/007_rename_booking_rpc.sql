-- PostgREST cannot expose overloaded functions with the same name.
-- Keep the timestamp-based booking RPC under a unique public name.
alter function public.create_booking_v2(
  text, text, text, date, date, timestamptz, timestamptz, timestamptz, jsonb
) rename to create_booking_v3;

grant execute on function public.create_booking_v3(
  text, text, text, date, date, timestamptz, timestamptz, timestamptz, jsonb
) to anon, authenticated;

notify pgrst, 'reload schema';
