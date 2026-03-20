export type PatrolStatus = "available" | "busy" | "dispatched";
export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type IncidentStatus = "pending" | "dispatched" | "resolved";

export interface Patrol {
  id: number;
  call_sign: string;
  latitude: number;
  longitude: number;
  status: PatrolStatus;
  target_incident_id: number | null;
  route_index: number | null;
  route_coordinates: Array<[number, number]> | null;
  created_at: string;
  updated_at: string;
}

export interface Incident {
  id: number;
  description: string;
  latitude: number;
  longitude: number;
  severity: IncidentSeverity;
  status: IncidentStatus;
  transcript: string | null;
  assigned_patrol_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface DispatchResult {
  incident: Incident;
  patrol: Patrol;
  instructions: string;
}

export interface TranscriptionChunk {
  text: string;
  timestamp: number;
}
