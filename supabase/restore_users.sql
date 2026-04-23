-- Restore users from backup
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
('75e20873-5139-4850-b439-b4e6db0aec3e', 'christie.swoboda@gmail.com', '$2a$10$0znX5qm7PJGjvEe345.PLusbC/9X0UYfz5oL/i8SGEvFj0vez5eke', '2025-09-19 05:54:23.682624+00', '{"provider": "email", "providers": ["email"]}', '{"sub": "75e20873-5139-4850-b439-b4e6db0aec3e", "email": "christie.swoboda@gmail.com", "email_verified": true, "phone_verified": false}', '2025-09-19 05:54:09.722964+00', '2025-09-19 06:11:12.017055+00'),
('6dca9e9c-1a31-4675-870e-bb3f15ca2b7f', 'paulhartman.bassist@gmail.com', '$2a$10$id4HUDAidQU.we86ejdiruTJ7CX/8QxEC3.kLT4t/lpOTO6TrFkbW', '2025-09-19 06:23:08.330885+00', '{"provider": "email", "providers": ["email"]}', '{"sub": "6dca9e9c-1a31-4675-870e-bb3f15ca2b7f", "email": "paulhartman.bassist@gmail.com", "phone": "7206848593", "company": "SSS", "pronouns": "he/him", "last_name": "Hartman", "first_name": "Paul", "display_name": "Paul Hartman", "email_verified": true, "phone_verified": false}', '2025-09-19 06:22:57.966993+00', '2025-09-26 20:15:46.752802+00')
ON CONFLICT (id) DO NOTHING;

-- Set paulhartman.bassist@gmail.com as admin
UPDATE profiles SET is_admin = TRUE WHERE id = '6dca9e9c-1a31-4675-870e-bb3f15ca2b7f';
