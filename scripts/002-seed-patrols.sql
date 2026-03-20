-- Seed patrol units around London
INSERT INTO patrols (call_sign, latitude, longitude, status) VALUES
  ('ALPHA-1', 51.5074, -0.1278, 'available'),
  ('BRAVO-2', 51.5155, -0.1419, 'available'),
  ('CHARLIE-3', 51.4995, -0.1248, 'busy'),
  ('DELTA-4', 51.5225, -0.1534, 'available'),
  ('ECHO-5', 51.5033, -0.1195, 'available'),
  ('FOXTROT-6', 51.5107, -0.1340, 'busy'),
  ('GOLF-7', 51.4952, -0.1350, 'available'),
  ('HOTEL-8', 51.5180, -0.1100, 'available')
ON CONFLICT (call_sign) DO NOTHING;
