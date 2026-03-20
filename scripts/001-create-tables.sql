-- Create enums for status types
CREATE TYPE patrol_status AS ENUM ('available', 'busy', 'assigned');
CREATE TYPE incident_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE incident_status AS ENUM ('pending', 'dispatched', 'resolved');

-- Patrols table
CREATE TABLE IF NOT EXISTS patrols (
  id SERIAL PRIMARY KEY,
  call_sign VARCHAR(50) NOT NULL UNIQUE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  status patrol_status DEFAULT 'available',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Incidents table
CREATE TABLE IF NOT EXISTS incidents (
  id SERIAL PRIMARY KEY,
  caller_name VARCHAR(255),
  caller_phone VARCHAR(50),
  description TEXT NOT NULL,
  location_address TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  severity incident_severity DEFAULT 'medium',
  status incident_status DEFAULT 'pending',
  transcript TEXT,
  assigned_patrol_id INTEGER REFERENCES patrols(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX idx_patrols_status ON patrols(status);
CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_incidents_assigned_patrol ON incidents(assigned_patrol_id);
