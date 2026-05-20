-- Query 1: Check all tables
SELECT table_schema, table_name 
FROM information_schema.tables 
WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
ORDER BY table_schema, table_name;

-- Query 2: Check if __drizzle_migrations__ table exists and its location
SELECT table_schema, table_name 
FROM information_schema.tables 
WHERE table_name = '__drizzle_migrations__';

-- Query 3: Check migration history (if table exists in public schema)
SELECT * FROM public.__drizzle_migrations__ ORDER BY id;

-- Query 4: Check migration history (if table exists in any schema - try this if Query 3 fails)
SELECT * FROM __drizzle_migrations__ ORDER BY id;

-- Query 5: Check calendar_notes_rel table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'calendar_notes_rel' 
ORDER BY ordinal_position;

-- Query 6: Count records in key tables
SELECT 'calendar_notes_rel' as table_name, COUNT(*) as row_count FROM calendar_notes_rel
UNION ALL
SELECT 'daily_snapshots', COUNT(*) FROM daily_snapshots
UNION ALL
SELECT 'daily_state', COUNT(*) FROM daily_state
UNION ALL
SELECT 'tasks', COUNT(*) FROM tasks
UNION ALL
SELECT 'users', COUNT(*) FROM users;
