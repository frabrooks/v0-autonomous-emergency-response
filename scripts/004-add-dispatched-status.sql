-- Add 'dispatched' value to patrol_status enum
ALTER TYPE patrol_status ADD VALUE IF NOT EXISTS 'dispatched';
