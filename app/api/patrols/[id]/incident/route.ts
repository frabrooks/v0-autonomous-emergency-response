import { sql } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const patrolId = parseInt(id, 10);

    if (isNaN(patrolId)) {
      return NextResponse.json({ error: "Invalid patrol ID" }, { status: 400 });
    }

    // Find incident assigned to this patrol
    const result = await sql`
      SELECT * FROM incidents 
      WHERE assigned_patrol_id = ${patrolId}
      AND status != 'resolved'
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (result.length === 0) {
      return NextResponse.json(null);
    }

    const incident = result[0];
    return NextResponse.json({
      ...incident,
      latitude: parseFloat(incident.latitude),
      longitude: parseFloat(incident.longitude),
    });
  } catch (error) {
    console.error("Error fetching patrol incident:", error);
    return NextResponse.json(
      { error: "Failed to fetch patrol incident" },
      { status: 500 }
    );
  }
}
