import { sql } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const incidentId = parseInt(id, 10);

    if (isNaN(incidentId)) {
      return NextResponse.json(
        { error: "Invalid incident ID" },
        { status: 400 }
      );
    }

    const incidents = await sql`
      SELECT i.*, p.call_sign as assigned_patrol_call_sign
      FROM incidents i
      LEFT JOIN patrols p ON i.assigned_patrol_id = p.id
      WHERE i.id = ${incidentId}
    `;

    if (incidents.length === 0) {
      return NextResponse.json(
        { error: "Incident not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(incidents[0]);
  } catch (error) {
    console.error("Error fetching incident:", error);
    return NextResponse.json(
      { error: "Failed to fetch incident" },
      { status: 500 }
    );
  }
}
