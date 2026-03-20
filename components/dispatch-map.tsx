"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Patrol, Incident } from "@/lib/types";

// Patrol icon - Green for available
const availablePatrolIcon = new L.DivIcon({
  className: "custom-marker",
  html: `<div style="width: 32px; height: 32px; border-radius: 50%; background-color: #22c55e; border: 2px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

// Patrol icon - Red for busy/unavailable
const busyPatrolIcon = new L.DivIcon({
  className: "custom-marker",
  html: `<div style="width: 32px; height: 32px; border-radius: 50%; background-color: #ef4444; border: 2px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

// Patrol icon - Orange/Yellow for dispatched (en route)
const dispatchedPatrolIcon = new L.DivIcon({
  className: "custom-marker",
  html: `<div style="width: 32px; height: 32px; border-radius: 50%; background-color: #f59e0b; border: 2px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; animation: pulse 2s infinite;">
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

// Removed MapUpdater - it was resetting zoom on every data refresh

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

  // Build route polylines for all dispatched patrols with route_coordinates
  const patrolRoutes = patrols
    .filter((p) => p.status === "dispatched" && p.route_coordinates && p.route_coordinates.length > 0)
    .map((patrol) => {
      // OSRM returns [lng, lat], Leaflet needs [lat, lng]
      const routeIndex = patrol.route_index || 0;
      // Show remaining route from current position
      const remainingRoute = patrol.route_coordinates!.slice(routeIndex);
      const positions = remainingRoute.map(
        (coord) => [coord[1], coord[0]] as [number, number]
      );
      return { patrolId: patrol.id, positions };
    });

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

      {/* Patrol Markers */}
      {patrols.map((patrol) => {
        // Determine icon based on status: green = available, red = busy, orange = dispatched
        const icon = patrol.status === "available" 
          ? availablePatrolIcon 
          : patrol.status === "dispatched" 
            ? dispatchedPatrolIcon 
            : busyPatrolIcon;
        
        return (
        <Marker
          key={`patrol-${patrol.id}`}
          position={[parseCoord(patrol.latitude), parseCoord(patrol.longitude)]}
          icon={icon}
        >
          <Popup>
            <div className="text-sm">
              <p className="font-bold">{patrol.call_sign}</p>
              <p className="capitalize">Status: {patrol.status}</p>
            </div>
          </Popup>
        </Marker>
        );
      })}

      {/* Incident Markers */}
      {incidents.map((incident) => {
        // Find the assigned patrol if any
        const assignedPatrol = incident.assigned_patrol_id 
          ? patrols.find(p => p.id === incident.assigned_patrol_id)
          : null;
        
        return (
          <Marker
            key={`incident-${incident.id}`}
            position={[parseCoord(incident.latitude), parseCoord(incident.longitude)]}
            icon={incidentIcon}
          >
            <Popup>
              <div className="text-sm min-w-[180px]">
                <p className="font-bold text-red-600 text-base">INCIDENT</p>
                <p className="mt-1">{incident.description}</p>
                <div className="mt-2 space-y-1 border-t pt-2">
                  <p><span className="font-medium">Severity:</span> <span className="capitalize">{incident.severity}</span></p>
                  <p><span className="font-medium">Status:</span> <span className="capitalize">{incident.status}</span></p>
                  {assignedPatrol ? (
                    <p className="text-green-700 font-medium">
                      Responding: {assignedPatrol.call_sign}
                    </p>
                  ) : incident.status === "pending" ? (
                    <p className="text-orange-600 font-medium">Awaiting dispatch</p>
                  ) : null}
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}

      {/* Route Lines for all dispatched patrols */}
      {patrolRoutes.map(({ patrolId, positions }) => (
        <Polyline
          key={`route-${patrolId}`}
          positions={positions}
          color="#3b82f6"
          weight={4}
          opacity={0.8}
        />
      ))}
    </MapContainer>
  );
}
