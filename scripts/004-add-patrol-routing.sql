-- Add routing columns to patrols table for simulation
-- route_coordinates: JSON array of [lat, lng] points from OSRM
-- route_index: current position along the route (0 = start, length = arrived)
-- target_incident_id: the incident this patrol is responding to

ALTER TABLE patrols 
ADD COLUMN IF NOT EXISTS route_coordinates JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS route_index INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS target_incident_id INTEGER DEFAULT NULL;

-- Add foreign key constraint for target_incident_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_patrol_target_incident'
  ) THEN
    ALTER TABLE patrols 
    ADD CONSTRAINT fk_patrol_target_incident 
    FOREIGN KEY (target_incident_id) REFERENCES incidents(id) ON DELETE SET NULL;
  END IF;
END $$;
