-- pg_cron jobs (requires pg_cron extension and CRON_SECRET set as app setting)

-- Refresh materialized view every hour
SELECT cron.schedule(
  'refresh-mv-hourly',
  '0 * * * *',
  $$ SELECT refresh_mv_daily_sales() $$
);

-- Nightly metrics calculation at 2am AEST (16:00 UTC)
SELECT cron.schedule(
  'nightly-metrics',
  '0 16 * * *',
  $$
  SELECT calculate_product_metrics(id)
  FROM organizations
  WHERE plan != 'free' OR TRUE
  $$
);

-- Note: morning-alerts cron is handled by Vercel Cron calling the API route
-- Vercel Cron schedule: 0 21 * * * (7am AEST = 21:00 UTC previous day)
