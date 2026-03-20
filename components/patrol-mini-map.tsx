"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Patrol, Incident } from "@/lib/types";

// Patrol icon - Orange/Yellow for dispatched (en route)
const patrolIcon = new L.DivIcon({
  className: "custom-marker",
  html: `<div style="width: 32px; height: 32px; border-radius: 50%; background-color: #f59e0b; border: 2px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

const incidentIcon = new L.DivIcon({
  className: "custom-marker",
  html: `<div style="width: 40px; height: 40px; border-radius: 50%; background-color: #ef4444; border: 2px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
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

interface PatrolMiniMapProps {
  patrol: Patrol;
  incident: Incident | null | undefined;
}

function MapBoundsUpdater({ patrol, incident }: { patrol: Patrol; incident: Incident | null | undefined }) {
  const map = useMap();

  useEffect(() => {
    const patrolPos: [number, number] = [parseCoord(patrol.latitude), parseCoord(patrol.longitude)];
    
    if (incident) {
      const incidentPos: [number, number] = [parseCoord(incident.latitude), parseCoord(incident.longitude)];
      const bounds = L.latLngBounds([patrolPos, incidentPos]);
      map.fitBounds(bounds, { padding: [50, 50] });
    } else {
      map.setView(patrolPos, 14);
    }
  }, [map, patrol, incident]);

  return null;
}

export default function PatrolMiniMap({ patrol, incident }: PatrolMiniMapProps) {
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

  const patrolPos: [number, number] = [parseCoord(patrol.latitude), parseCoord(patrol.longitude)];
  const incidentPos: [number, number] | null = incident
    ? [parseCoord(incident.latitude), parseCoord(incident.longitude)]
    : null;

  // Create route line between patrol and incident
  const routeLine = incidentPos ? [patrolPos, incidentPos] : null;

  return (
    <MapContainer
      center={patrolPos}
      zoom={14}
      className="w-full h-full"
      style={{ background: "hsl(222 47% 11%)" }}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapBoundsUpdater patrol={patrol} incident={incident} />

      {/* Patrol Marker */}
      <Marker position={patrolPos} icon={patrolIcon}>
        <Popup>
          <div className="text-sm">
            <p className="font-bold">{patrol.call_sign}</p>
            <p className="text-orange-600">Your Location</p>
          </div>
        </Popup>
      </Marker>

      {/* Incident Marker */}
      {incidentPos && incident && (
        <Marker position={incidentPos} icon={incidentIcon}>
          <Popup>
            <div className="text-sm min-w-[150px]">
              <p className="font-bold text-red-600">INCIDENT</p>
              <p className="mt-1">{incident.description}</p>
              <p className="text-xs text-muted-foreground capitalize mt-1">
                Severity: {incident.severity}
              </p>
            </div>
          </Popup>
        </Marker>
      )}

      {/* Route Line connecting patrol to incident */}
      {routeLine && (
        <Polyline
          positions={routeLine}
          color="#3b82f6"
          weight={4}
          dashArray="10, 10"
          opacity={0.8}
        />
      )}
    </MapContainer>
  );
}
