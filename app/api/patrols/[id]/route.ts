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
      return NextResponse.json(
        { error: "Invalid patrol ID" },
        { status: 400 }
      );
    }

    const patrols = await sql`
      SELECT * FROM patrols 
      WHERE id = ${patrolId}
    `;

    if (patrols.length === 0) {
      return NextResponse.json(
        { error: "Patrol not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(patrols[0]);
  } catch (error) {
    console.error("Error fetching patrol:", error);
    return NextResponse.json(
      { error: "Failed to fetch patrol" },
      { status: 500 }
    );
  }
}
