import { sql } from "@/lib/db";
import { NextResponse } from "next/server";

// Distance threshold in meters to consider patrol "arrived" at incident
const ARRIVAL_THRESHOLD_METERS = 50;

// Number of route points to advance per simulation tick
const ROUTE_ADVANCE_STEP = 3;

// Calculate distance between two points using Haversine formula
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function POST() {
  try {
    // Get all dispatched patrols with route data
    const dispatchedPatrols = await sql`
      SELECT 
        p.id,
        p.latitude,
        p.longitude,
        p.route_coordinates,
        p.route_index,
        p.target_incident_id,
        i.latitude as incident_lat,
        i.longitude as incident_lng
      FROM patrols p
      LEFT JOIN incidents i ON p.target_incident_id = i.id
      WHERE p.status = 'dispatched'
        AND p.route_coordinates IS NOT NULL
        AND p.target_incident_id IS NOT NULL
    `;

    const updates: { patrolId: number; resolved: boolean }[] = [];

    for (const patrol of dispatchedPatrols) {
      const routeCoords = patrol.route_coordinates as [number, number][];
      let currentIndex = patrol.route_index || 0;
      
      // Advance position along the route
      const newIndex = Math.min(currentIndex + ROUTE_ADVANCE_STEP, routeCoords.length - 1);
      const newPosition = routeCoords[newIndex]; // [lng, lat]
      const newLng = newPosition[0];
      const newLat = newPosition[1];

      // Check distance to incident
      const distanceToIncident = haversineDistance(
        newLat,
        newLng,
        patrol.incident_lat,
        patrol.incident_lng
      );

      const hasArrived = distanceToIncident <= ARRIVAL_THRESHOLD_METERS || newIndex >= routeCoords.length - 1;

      if (hasArrived) {
        // Patrol has arrived - resolve incident and make patrol available
        await sql`
          UPDATE incidents 
          SET status = 'resolved', updated_at = NOW()
          WHERE id = ${patrol.target_incident_id}
        `;

        await sql`
          UPDATE patrols 
          SET 
            status = 'available',
            latitude = ${patrol.incident_lat},
            longitude = ${patrol.incident_lng},
            location = ST_SetSRID(ST_MakePoint(${patrol.incident_lng}, ${patrol.incident_lat}), 4326)::geography,
            route_coordinates = NULL,
            route_index = 0,
            target_incident_id = NULL,
            updated_at = NOW()
          WHERE id = ${patrol.id}
        `;

        updates.push({ patrolId: patrol.id, resolved: true });
      } else {
        // Update patrol position along the route
        await sql`
          UPDATE patrols 
          SET 
            latitude = ${newLat},
            longitude = ${newLng},
            location = ST_SetSRID(ST_MakePoint(${newLng}, ${newLat}), 4326)::geography,
            route_index = ${newIndex},
            updated_at = NOW()
          WHERE id = ${patrol.id}
        `;

        updates.push({ patrolId: patrol.id, resolved: false });
      }
    }

    return NextResponse.json({
      success: true,
      updatedPatrols: updates.length,
      resolvedIncidents: updates.filter((u) => u.resolved).length,
      updates,
    });
  } catch (error) {
    console.error("Error in simulation:", error);
    return NextResponse.json(
      { error: "Failed to simulate patrol movement" },
      { status: 500 }
    );
  }
}
