import { sql } from "@/lib/db";
import { NextResponse } from "next/server";
import type { Patrol, Incident, OSRMResponse } from "@/lib/types";

// Fetch route from OSRM public API
async function fetchOSRMRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Promise<[number, number][] | null> {
  try {
    // OSRM expects coordinates as lng,lat
    const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error("OSRM API error:", response.status);
      return null;
    }
    
    const data: OSRMResponse = await response.json();
    
    if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
      console.error("OSRM returned no routes:", data.code);
      return null;
    }
    
    return data.routes[0].geometry.coordinates;
  } catch (error) {
    console.error("Failed to fetch OSRM route:", error);
    return null;
  }
}

// Generate direction based on coordinate differences
function getDirection(fromLat: number, fromLon: number, toLat: number, toLon: number): string {
  const latDiff = toLat - fromLat;
  const lonDiff = toLon - fromLon;
  
  let direction = "";
  if (Math.abs(latDiff) > 0.001) {
    direction += latDiff > 0 ? "North" : "South";
  }
  if (Math.abs(lonDiff) > 0.001) {
    direction += lonDiff > 0 ? "east" : "west";
  }
  return direction || "nearby";
}

// Generate dispatch instructions without AI
function generateDispatchInstructions(
  patrol: Patrol,
  incident: Incident,
  distanceKm: number
): string {
  const direction = getDirection(
    patrol.latitude,
    patrol.longitude,
    incident.latitude,
    incident.longitude
  );
  
  const severityReminders: Record<string, string> = {
    critical: "Code 3 response. Exercise extreme caution. Request backup if needed.",
    high: "Expedited response. Assess threat level on approach.",
    medium: "Standard response. Maintain situational awareness.",
    low: "Routine response. Report status on arrival.",
  };

  const reminder = severityReminders[incident.severity] || severityReminders.medium;
  const radioCode = `${patrol.call_sign}-${Date.now().toString(36).slice(-4).toUpperCase()}`;

  return `DISPATCH CONFIRMED: ${patrol.call_sign} responding to incident.
Location: ${distanceKm.toFixed(2)} km ${direction}.
Incident: ${incident.description}
Severity: ${incident.severity.toUpperCase()}
${reminder}
Radio confirmation: ${radioCode}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { incidentId } = body;

    // Get the incident
    const incidents = await sql`
      SELECT * FROM incidents WHERE id = ${incidentId}
    `;
    
    if (incidents.length === 0) {
      return NextResponse.json(
        { error: "Incident not found" },
        { status: 404 }
      );
    }
    
    const incident = incidents[0] as Incident;

    // Use PostGIS to find the nearest available patrol
    // ST_Distance calculates distance in meters between geography points
    const nearestPatrols = await sql`
      SELECT 
        p.*,
        ST_Distance(p.location, i.location) / 1000 as distance_km
      FROM patrols p
      CROSS JOIN incidents i
      WHERE p.status = 'available'
        AND i.id = ${incidentId}
        AND p.location IS NOT NULL
        AND i.location IS NOT NULL
      ORDER BY ST_Distance(p.location, i.location)
      LIMIT 1
    `;

    if (nearestPatrols.length === 0) {
      return NextResponse.json(
        { error: "No available patrols" },
        { status: 400 }
      );
    }

    const nearestPatrol = nearestPatrols[0] as Patrol & { distance_km: number };
    const distanceKm = nearestPatrol.distance_km;

    // Generate dispatch instructions without AI
    const instructions = generateDispatchInstructions(
      nearestPatrol,
      incident,
      distanceKm
    );

    // Fetch the route from OSRM
    const routeCoordinates = await fetchOSRMRoute(
      nearestPatrol.latitude,
      nearestPatrol.longitude,
      incident.latitude,
      incident.longitude
    );

    // Update patrol status to dispatched with route data
    await sql`
      UPDATE patrols SET 
        status = 'dispatched', 
        route_coordinates = ${routeCoordinates ? JSON.stringify(routeCoordinates) : null}::jsonb,
        route_index = 0,
        target_incident_id = ${incidentId},
        updated_at = NOW()
      WHERE id = ${nearestPatrol.id}
    `;

    // Update incident with assigned patrol
    await sql`
      UPDATE incidents 
      SET assigned_patrol_id = ${nearestPatrol.id}, status = 'dispatched', updated_at = NOW()
      WHERE id = ${incidentId}
    `;

    // Fetch the updated records
    const updatedIncident = await sql`
      SELECT * FROM incidents WHERE id = ${incidentId}
    `;
    const updatedPatrol = await sql`
      SELECT * FROM patrols WHERE id = ${nearestPatrol.id}
    `;

    return NextResponse.json({
      incident: updatedIncident[0],
      patrol: updatedPatrol[0],
      instructions,
      distance: distanceKm.toFixed(2),
    });
  } catch (error) {
    console.error("Error dispatching patrol:", error);
    return NextResponse.json(
      { error: "Failed to dispatch patrol" },
      { status: 500 }
    );
  }
}
