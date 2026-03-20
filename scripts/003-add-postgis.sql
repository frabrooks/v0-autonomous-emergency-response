-- Enable PostGIS extension for spatial queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add geography columns to patrols table
ALTER TABLE patrols ADD COLUMN IF NOT EXISTS location geography(POINT, 4326);

-- Add geography columns to incidents table
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS location geography(POINT, 4326);

-- Populate the geography columns from existing lat/long data
UPDATE patrols 
SET location = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

UPDATE incidents 
SET location = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Create spatial indexes for fast nearest neighbor queries
CREATE INDEX IF NOT EXISTS idx_patrols_location ON patrols USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_incidents_location ON incidents USING GIST (location);
