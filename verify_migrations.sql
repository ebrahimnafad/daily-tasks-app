-- Verify the complete migration history after the fix
SELECT * FROM drizzle.__drizzle_migrations ORDER BY id;
