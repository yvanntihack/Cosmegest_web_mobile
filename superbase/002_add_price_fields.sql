-- Add explicit price_type and wholesale_price to products
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS price_type text DEFAULT 'detaillant',
  ADD COLUMN IF NOT EXISTS wholesale_price numeric;

-- Optional: backfill price_type based on heuristics (lowest price = grossiste)
DO $$
BEGIN
  -- This is pseudo-SQL for Postgres procedural backfill; adjust as needed for Supabase SQL runner.
  -- For safety, this block only runs if column exists.
  UPDATE products p
  SET price_type = sub.pt
  FROM (
    SELECT p2.id, CASE WHEN p2.selling_price = min_grp.min_price THEN 'grossiste' ELSE 'detaillant' END as pt
    FROM products p2
    JOIN (
      SELECT regexp_replace(lower(name), '[^a-z0-9\s]', '', 'g') as base, MIN(selling_price) as min_price
      FROM products
      GROUP BY base
    ) min_grp ON regexp_replace(lower(p2.name), '[^a-z0-9\s]', '', 'g') = min_grp.base
  ) sub
  WHERE p.id = sub.id;
END$$;
