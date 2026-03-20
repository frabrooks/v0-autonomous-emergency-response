import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { createAzure } from "@ai-sdk/azure";
import { z } from "zod";

const incidentSchema = z.object({
  description: z.string().describe("A concise description of the incident"),
  severity: z
    .enum(["low", "medium", "high", "critical"])
    .describe("The severity level of the incident"),
  latitude: z.number().describe("Estimated latitude of the incident location"),
  longitude: z
    .number()
    .describe("Estimated longitude of the incident location"),
  suggestedActions: z
    .array(z.string())
    .describe("List of suggested immediate actions"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { transcript } = body;

    if (!transcript) {
      return NextResponse.json(
        { error: "No transcript provided" },
        { status: 400 }
      );
    }

    // Create Azure OpenAI provider
    const azure = createAzure({
      resourceName: process.env.AZURE_OPENAI_RESOURCE_NAME!,
      apiKey: process.env.AZURE_OPENAI_API_KEY!,
    });

    const { object: analysis } = await generateObject({
      model: azure(process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "gpt-4o-mini"),
      schema: incidentSchema,
      prompt: `You are an emergency dispatch AI assistant analyzing a 999 emergency call transcript.

Transcript:
"${transcript}"

Based on this transcript, extract the following information:
1. A concise description of the incident
2. Severity level (low, medium, high, critical) based on:
   - Critical: Life-threatening, active violence, major accidents
   - High: Serious injury, property damage in progress, urgent medical
   - Medium: Non-violent disputes, minor injuries, property concerns
   - Low: Noise complaints, suspicious activity (non-threatening), minor issues
3. Estimated location coordinates (use London area coordinates: lat ~51.5, lon ~-0.1 as defaults, adjust based on any location mentions)
4. Suggested immediate actions for responding officers

Be accurate and professional in your analysis.`,
    });

    return NextResponse.json(analysis);
  } catch (error) {
    console.error("Error analyzing transcript:", error);
    return NextResponse.json(
      { error: "Failed to analyze transcript" },
      { status: 500 }
    );
  }
}
