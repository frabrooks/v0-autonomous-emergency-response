import { sql } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const incidents = await sql`
      SELECT i.*, p.call_sign as assigned_patrol_call_sign
      FROM incidents i
      LEFT JOIN patrols p ON i.assigned_patrol_id = p.id
      ORDER BY i.created_at DESC
    `;
    return NextResponse.json(incidents);
  } catch (error) {
    console.error("Error fetching incidents:", error);
    return NextResponse.json(
      { error: "Failed to fetch incidents" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { description, latitude, longitude, severity, transcript } = body;

    // First insert the incident
    const result = await sql`
      INSERT INTO incidents (description, latitude, longitude, severity, transcript, status)
      VALUES (${description}, ${latitude}, ${longitude}, ${severity}, ${transcript}, 'pending')
      RETURNING *
    `;
    
    // Then update the location using PostGIS (parameterized queries don't work well inside PostGIS functions)
    const incidentId = result[0].id;
    await sql`
      UPDATE incidents 
      SET location = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
      WHERE id = ${incidentId}
    `;

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error("Error creating incident:", error);
    return NextResponse.json(
      { error: "Failed to create incident" },
      { status: 500 }
    );
  }
}
