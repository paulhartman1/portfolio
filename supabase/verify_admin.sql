-- Run this in Supabase SQL Editor to verify and set admin status

-- Check current admin status
SELECT email, is_admin FROM profiles WHERE email = 'paulhartman.bassist@gmail.com';

-- Force set you as admin
UPDATE profiles SET is_admin = TRUE WHERE email = 'paulhartman.bassist@gmail.com';

-- Verify it worked
SELECT email, is_admin FROM profiles WHERE email = 'paulhartman.bassist@gmail.com';
