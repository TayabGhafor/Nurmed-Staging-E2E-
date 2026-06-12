-- =====================================================
-- DIAGNOSE DOCTOR TABLE ISSUE
-- =====================================================

-- Check if doctor table exists in any schema
SELECT 
    schemaname, 
    tablename, 
    tableowner 
FROM pg_tables 
WHERE tablename = 'doctor';

-- Check current database and schema
SELECT current_database(), current_schema();

-- Check if you can see the table
SELECT table_name FROM information_schema.tables WHERE table_name = 'doctor';

-- Check if you can see any tables
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- Try to select from doctor table
SELECT COUNT(*) FROM doctor;

-- Check permissions
SELECT 
    table_name,
    privilege_type,
    grantee
FROM information_schema.table_privileges 
WHERE table_name = 'doctor';
