begin;
select plan(25);

-- F3: public.catalog_estimate_lines (supabase/migrations/0006_functions_billing_marketplace.sql)
-- bakes in its own copy of src/domain/rateCard.ts's RATE_CARD, QTY_PER_SQFT and
-- CONTINGENCY_RATE constants. This test hardcodes those exact TS values and
-- checks the SQL function returns the same numbers, so the two copies can't
-- silently drift apart. It does not try to share code between TS and SQL.

-- RATE_CARD: rate per unit, per level (src/domain/rateCard.ts).
select is((select (x.line ->> 'rate')::numeric from jsonb_array_elements(public.catalog_estimate_lines(1000, 'basic')) x(line) where x.line ->> 'item' = 'Cement (OPC 53 Grade)'), 350::numeric, 'basic cement rate matches RATE_CARD.cement.basic');
select is((select (x.line ->> 'rate')::numeric from jsonb_array_elements(public.catalog_estimate_lines(1000, 'standard')) x(line) where x.line ->> 'item' = 'Cement (OPC 53 Grade)'), 380::numeric, 'standard cement rate matches RATE_CARD.cement.standard');
select is((select (x.line ->> 'rate')::numeric from jsonb_array_elements(public.catalog_estimate_lines(1000, 'premium')) x(line) where x.line ->> 'item' = 'Cement (OPC 53 Grade)'), 420::numeric, 'premium cement rate matches RATE_CARD.cement.premium');

select is((select (x.line ->> 'rate')::numeric from jsonb_array_elements(public.catalog_estimate_lines(1000, 'basic')) x(line) where x.line ->> 'item' = 'TMT Steel (Fe 500)'), 62000::numeric, 'basic steel rate matches RATE_CARD.steel.basic');
select is((select (x.line ->> 'rate')::numeric from jsonb_array_elements(public.catalog_estimate_lines(1000, 'standard')) x(line) where x.line ->> 'item' = 'TMT Steel (Fe 500)'), 70000::numeric, 'standard steel rate matches RATE_CARD.steel.standard');
select is((select (x.line ->> 'rate')::numeric from jsonb_array_elements(public.catalog_estimate_lines(1000, 'premium')) x(line) where x.line ->> 'item' = 'TMT Steel (Fe 500)'), 78000::numeric, 'premium steel rate matches RATE_CARD.steel.premium');

select is((select (x.line ->> 'rate')::numeric from jsonb_array_elements(public.catalog_estimate_lines(1000, 'basic')) x(line) where x.line ->> 'item' = 'AAC Blocks'), 60::numeric, 'basic blocks rate matches RATE_CARD.blocks.basic');
select is((select (x.line ->> 'rate')::numeric from jsonb_array_elements(public.catalog_estimate_lines(1000, 'standard')) x(line) where x.line ->> 'item' = 'AAC Blocks'), 70::numeric, 'standard blocks rate matches RATE_CARD.blocks.standard');
select is((select (x.line ->> 'rate')::numeric from jsonb_array_elements(public.catalog_estimate_lines(1000, 'premium')) x(line) where x.line ->> 'item' = 'AAC Blocks'), 85::numeric, 'premium blocks rate matches RATE_CARD.blocks.premium');

select is((select (x.line ->> 'rate')::numeric from jsonb_array_elements(public.catalog_estimate_lines(1000, 'basic')) x(line) where x.line ->> 'item' = 'Mason (skilled)'), 850::numeric, 'basic mason rate matches RATE_CARD.mason.basic');
select is((select (x.line ->> 'rate')::numeric from jsonb_array_elements(public.catalog_estimate_lines(1000, 'standard')) x(line) where x.line ->> 'item' = 'Mason (skilled)'), 950::numeric, 'standard mason rate matches RATE_CARD.mason.standard');
select is((select (x.line ->> 'rate')::numeric from jsonb_array_elements(public.catalog_estimate_lines(1000, 'premium')) x(line) where x.line ->> 'item' = 'Mason (skilled)'), 1100::numeric, 'premium mason rate matches RATE_CARD.mason.premium');

select is((select (x.line ->> 'rate')::numeric from jsonb_array_elements(public.catalog_estimate_lines(1000, 'basic')) x(line) where x.line ->> 'item' = 'Helper (unskilled)'), 550::numeric, 'basic helper rate matches RATE_CARD.helper.basic');
select is((select (x.line ->> 'rate')::numeric from jsonb_array_elements(public.catalog_estimate_lines(1000, 'standard')) x(line) where x.line ->> 'item' = 'Helper (unskilled)'), 600::numeric, 'standard helper rate matches RATE_CARD.helper.standard');
select is((select (x.line ->> 'rate')::numeric from jsonb_array_elements(public.catalog_estimate_lines(1000, 'premium')) x(line) where x.line ->> 'item' = 'Helper (unskilled)'), 680::numeric, 'premium helper rate matches RATE_CARD.helper.premium');

select is((select (x.line ->> 'rate')::numeric from jsonb_array_elements(public.catalog_estimate_lines(1000, 'basic')) x(line) where x.line ->> 'item' = 'Finishing works (flooring, painting, fixtures)'), 180::numeric, 'basic finishing rate matches RATE_CARD.finishing.basic');
select is((select (x.line ->> 'rate')::numeric from jsonb_array_elements(public.catalog_estimate_lines(1000, 'standard')) x(line) where x.line ->> 'item' = 'Finishing works (flooring, painting, fixtures)'), 234::numeric, 'standard finishing rate matches RATE_CARD.finishing.standard');
select is((select (x.line ->> 'rate')::numeric from jsonb_array_elements(public.catalog_estimate_lines(1000, 'premium')) x(line) where x.line ->> 'item' = 'Finishing works (flooring, painting, fixtures)'), 320::numeric, 'premium finishing rate matches RATE_CARD.finishing.premium');

-- QTY_PER_SQFT: quantity consumed per sq ft, independent of level (area = 1000).
select is((select (x.line ->> 'quantity')::numeric from jsonb_array_elements(public.catalog_estimate_lines(1000, 'basic')) x(line) where x.line ->> 'item' = 'Cement (OPC 53 Grade)'), 930::numeric, 'cement quantity matches QTY_PER_SQFT.cement (0.93/sqft)');
select is((select (x.line ->> 'quantity')::numeric from jsonb_array_elements(public.catalog_estimate_lines(1000, 'basic')) x(line) where x.line ->> 'item' = 'TMT Steel (Fe 500)'), 6.0::numeric, 'steel quantity matches QTY_PER_SQFT.steel (0.006/sqft)');
select is((select (x.line ->> 'quantity')::numeric from jsonb_array_elements(public.catalog_estimate_lines(1000, 'basic')) x(line) where x.line ->> 'item' = 'AAC Blocks'), 3600::numeric, 'blocks quantity matches QTY_PER_SQFT.blocks (3.6/sqft)');
select is((select (x.line ->> 'quantity')::numeric from jsonb_array_elements(public.catalog_estimate_lines(1000, 'basic')) x(line) where x.line ->> 'item' = 'Mason (skilled)'), 270::numeric, 'mason quantity matches QTY_PER_SQFT.mason (0.27/sqft)');
select is((select (x.line ->> 'quantity')::numeric from jsonb_array_elements(public.catalog_estimate_lines(1000, 'basic')) x(line) where x.line ->> 'item' = 'Helper (unskilled)'), 350::numeric, 'helper quantity matches QTY_PER_SQFT.helper (0.35/sqft)');
select is((select (x.line ->> 'quantity')::numeric from jsonb_array_elements(public.catalog_estimate_lines(1000, 'basic')) x(line) where x.line ->> 'item' = 'Finishing works (flooring, painting, fixtures)'), 1000::numeric, 'finishing quantity is the built-up area itself');

-- CONTINGENCY_RATE: 5% of the subtotal of every other line.
select is(
  (select (x.line ->> 'amount')::numeric from jsonb_array_elements(public.catalog_estimate_lines(1000, 'basic')) x(line) where x.line ->> 'category' = 'contingency'),
  (select round(sum((x.line ->> 'amount')::numeric) * 0.05, 10) from jsonb_array_elements(public.catalog_estimate_lines(1000, 'basic')) x(line) where x.line ->> 'category' <> 'contingency'),
  'contingency amount matches CONTINGENCY_RATE (5% of the subtotal)');

select * from finish();
rollback;
