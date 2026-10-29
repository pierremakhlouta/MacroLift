-- Cardio exercises are logged as time and distance instead of weight and reps.
-- A new enum value can't be used in the transaction that adds it, so this is its own migration.
--   cardio : duration_seconds / distance_m on the set; weight_kg and reps are unused

alter type public.load_type add value if not exists 'cardio';
