import { sql } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const patrols = await sql`
      SELECT * FROM patrols 
      ORDER BY call_sign ASC
    `;
    return NextResponse.json(patrols);
  } catch (error) {
    console.error("Error fetching patrols:", error);
    return NextResponse.json(
      { error: "Failed to fetch patrols" },
      { status: 500 }
    );
  }
}
