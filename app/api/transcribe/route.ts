import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File;

    if (!audioFile) {
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 }
      );
    }

    // Convert File to ArrayBuffer then to Buffer
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Use OpenAI Whisper API for transcription
    const openaiResponse = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: (() => {
          const fd = new FormData();
          fd.append(
            "file",
            new Blob([buffer], { type: audioFile.type }),
            audioFile.name || "audio.webm"
          );
          fd.append("model", "whisper-1");
          fd.append("response_format", "json");
          return fd;
        })(),
      }
    );

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.text();
      console.error("OpenAI API error:", errorData);
      return NextResponse.json(
        { error: "Transcription failed" },
        { status: 500 }
      );
    }

    const data = await openaiResponse.json();

    return NextResponse.json({ text: data.text });
  } catch (error) {
    console.error("Error transcribing audio:", error);
    return NextResponse.json(
      { error: "Failed to transcribe audio" },
      { status: 500 }
    );
  }
}
