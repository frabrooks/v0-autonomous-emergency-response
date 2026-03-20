import { NextResponse } from "next/server";

export async function GET() {
  const speechKey = process.env.AZURE_SPEECH_KEY;
  const speechRegion = process.env.AZURE_SPEECH_REGION;

  if (!speechKey || !speechRegion) {
    return NextResponse.json(
      { error: "Azure Speech credentials not configured. Please set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION environment variables." },
      { status: 500 }
    );
  }

  try {
    // Fetch a token from Azure AI Services (formerly Cognitive Services) Speech
    // This uses the token endpoint for browser-based recognition
    const tokenResponse = await fetch(
      `https://${speechRegion}.api.cognitive.microsoft.com/sts/v1.0/issueToken`,
      {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": speechKey,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Azure Speech token error:", errorText);
      throw new Error(`Failed to fetch speech token: ${tokenResponse.status}`);
    }

    const token = await tokenResponse.text();

    // Return token, region, and the speech endpoint for the client
    return NextResponse.json({
      token,
      region: speechRegion,
      endpoint: `https://${speechRegion}.api.cognitive.microsoft.com`,
    });
  } catch (error) {
    console.error("Error fetching speech token:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get speech token" },
      { status: 500 }
    );
  }
}
