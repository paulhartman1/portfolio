-- Add has_seen_welcome column to profiles table
ALTER TABLE profiles 
ADD COLUMN has_seen_welcome BOOLEAN DEFAULT FALSE;

-- Update existing users to have seen welcome (they're already using the system)
UPDATE profiles SET has_seen_welcome = TRUE;

-- New users created from now on will have has_seen_welcome = FALSE by default
