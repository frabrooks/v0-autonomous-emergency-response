import { NextResponse } from "next/server";

// This API endpoint is a fallback for batch transcription using Azure Speech Services
// The main real-time transcription happens client-side via the Speech SDK
// This can be used for file uploads or when browser microphone access isn't available

export async function POST(request: Request) {
  const speechKey = process.env.AZURE_SPEECH_KEY;
  const speechRegion = process.env.AZURE_SPEECH_REGION;

  if (!speechKey || !speechRegion) {
    return NextResponse.json(
      { error: "Azure Speech credentials not configured. Please set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION." },
      { status: 500 }
    );
  }

  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File;

    if (!audioFile) {
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 }
      );
    }

    // Convert File to ArrayBuffer
    const arrayBuffer = await audioFile.arrayBuffer();

    // Use Azure Speech Services batch transcription REST API
    // Note: For short audio files, we use the REST API directly
    const response = await fetch(
      `https://${speechRegion}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-GB`,
      {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": speechKey,
          "Content-Type": audioFile.type || "audio/wav",
          "Accept": "application/json",
        },
        body: arrayBuffer,
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Azure Speech API error:", errorData);
      return NextResponse.json(
        { error: "Transcription failed", details: errorData },
        { status: 500 }
      );
    }

    const data = await response.json();

    // Azure returns RecognitionStatus and DisplayText
    if (data.RecognitionStatus === "Success") {
      return NextResponse.json({ text: data.DisplayText });
    } else {
      return NextResponse.json(
        { error: `Recognition failed: ${data.RecognitionStatus}` },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error transcribing audio:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to transcribe audio" },
      { status: 500 }
    );
  }
}
