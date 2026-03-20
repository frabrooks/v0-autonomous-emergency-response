import { sql } from "@/lib/db";
import { NextResponse } from "next/server";
import { generateText } from "ai";
import type { Patrol, Incident } from "@/lib/types";

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
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

    // Get available patrols
    const patrols = await sql`
      SELECT * FROM patrols WHERE status = 'available'
    `;

    if (patrols.length === 0) {
      return NextResponse.json(
        { error: "No available patrols" },
        { status: 400 }
      );
    }

    // Find the nearest patrol
    let nearestPatrol: Patrol | null = null;
    let minDistance = Infinity;

    for (const patrol of patrols as Patrol[]) {
      const distance = calculateDistance(
        incident.latitude,
        incident.longitude,
        patrol.latitude,
        patrol.longitude
      );
      if (distance < minDistance) {
        minDistance = distance;
        nearestPatrol = patrol;
      }
    }

    if (!nearestPatrol) {
      return NextResponse.json(
        { error: "Could not find nearest patrol" },
        { status: 500 }
      );
    }

    // Generate navigation instructions using AI
    const { text: instructions } = await generateText({
      model: "openai/gpt-4o-mini",
      prompt: `You are a police dispatch assistant. Generate brief, clear navigation instructions for patrol unit ${nearestPatrol.call_sign}.

Current patrol location: ${nearestPatrol.latitude}, ${nearestPatrol.longitude} (approximately ${minDistance.toFixed(2)} km away)
Incident location: ${incident.latitude}, ${incident.longitude}
Incident description: ${incident.description}
Severity: ${incident.severity}

Provide:
1. A brief acknowledgment of the dispatch
2. Estimated distance and direction
3. Key safety reminders based on incident severity
4. Radio confirmation code

Keep the response concise and professional, suitable for police radio communication.`,
    });

    // Update patrol status to dispatched
    await sql`
      UPDATE patrols SET status = 'dispatched', updated_at = NOW()
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
      distance: minDistance.toFixed(2),
    });
  } catch (error) {
    console.error("Error dispatching patrol:", error);
    return NextResponse.json(
      { error: "Failed to dispatch patrol" },
      { status: 500 }
    );
  }
}
