-- Set a password for dev login (run in Supabase SQL Editor)
-- This allows you to bypass magic links in development

UPDATE auth.users
SET encrypted_password = crypt('dev-password-123', gen_salt('bf'))
WHERE email = 'paulhartman.bassist@gmail.com';
