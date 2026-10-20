-- Aggregate display data is read-only. Preserve SELECT, service grants,
-- view definition and underlying RLS; no existing row is changed.
revoke insert, update, delete on public.current_seasonal_xp_totals
from public, anon, authenticated;
