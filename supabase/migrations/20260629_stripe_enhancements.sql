-- Add paid_at timestamp for tracking when payment was completed
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Add description field for payment descriptions
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS description TEXT;

-- Update existing 'completed' payments to have a paid_at timestamp
UPDATE payments 
SET paid_at = updated_at 
WHERE status = 'completed' AND paid_at IS NULL;
