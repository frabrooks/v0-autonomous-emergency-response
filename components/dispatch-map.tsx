"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Patrol, Incident } from "@/lib/types";

// Fix default marker icons
const patrolIcon = new L.DivIcon({
  className: "custom-marker",
  html: `<div class="w-8 h-8 rounded-full bg-primary border-2 border-white shadow-lg flex items-center justify-center">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

const dispatchedPatrolIcon = new L.DivIcon({
  className: "custom-marker",
  html: `<div class="w-8 h-8 rounded-full bg-warning border-2 border-white shadow-lg flex items-center justify-center animate-pulse">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

const incidentIcon = new L.DivIcon({
  className: "custom-marker",
  html: `<div class="w-10 h-10 rounded-full bg-destructive border-2 border-white shadow-lg flex items-center justify-center animate-pulse">
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
  </div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40],
});

// Helper to safely parse coordinates from DB (may be string or number)
function parseCoord(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === "string" ? parseFloat(value) : value;
}

interface DispatchMapProps {
  patrols: Patrol[];
  incidents: Incident[];
  selectedIncidentId?: number;
  selectedPatrolId?: number;
}

function MapUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center, zoom]);
  return null;
}

export default function DispatchMap({
  patrols,
  incidents,
  selectedIncidentId,
  selectedPatrolId,
}: DispatchMapProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-full h-full bg-secondary/50 flex items-center justify-center">
        <p className="text-muted-foreground">Loading map...</p>
      </div>
    );
  }

  // Default center on London
  const center: [number, number] = [51.505, -0.09];
  const zoom = 12;

  // Find selected incident and patrol for drawing route
  const selectedIncident = incidents.find((i) => i.id === selectedIncidentId);
  const selectedPatrol = patrols.find((p) => p.id === selectedPatrolId);

  // Create route line between dispatched patrol and incident
  const routeLine =
    selectedIncident && selectedPatrol
      ? [
          [parseCoord(selectedPatrol.latitude), parseCoord(selectedPatrol.longitude)] as [number, number],
          [parseCoord(selectedIncident.latitude), parseCoord(selectedIncident.longitude)] as [number, number],
        ]
      : null;

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      className="w-full h-full"
      style={{ background: "hsl(222 47% 11%)" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapUpdater center={center} zoom={zoom} />

      {/* Patrol Markers */}
      {patrols.map((patrol) => (
        <Marker
          key={`patrol-${patrol.id}`}
          position={[parseCoord(patrol.latitude), parseCoord(patrol.longitude)]}
          icon={patrol.status === "dispatched" ? dispatchedPatrolIcon : patrolIcon}
        >
          <Popup>
            <div className="text-sm">
              <p className="font-bold">{patrol.call_sign}</p>
              <p className="capitalize">Status: {patrol.status}</p>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Incident Markers */}
      {incidents.map((incident) => (
        <Marker
          key={`incident-${incident.id}`}
          position={[parseCoord(incident.latitude), parseCoord(incident.longitude)]}
          icon={incidentIcon}
        >
          <Popup>
            <div className="text-sm">
              <p className="font-bold text-red-600">INCIDENT</p>
              <p>{incident.description}</p>
              <p className="capitalize">Severity: {incident.severity}</p>
              <p className="capitalize">Status: {incident.status}</p>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Route Line */}
      {routeLine && (
        <Polyline
          positions={routeLine}
          color="hsl(217, 91%, 60%)"
          weight={3}
          dashArray="10, 10"
        />
      )}
    </MapContainer>
  );
}
