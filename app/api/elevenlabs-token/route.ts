import { NextResponse } from "next/server";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const apiKey = process.env.ELEVENLABS_API_KEY || "";

export async function POST() {
  if (!apiKey) {
    return NextResponse.json(
      { error: "ElevenLabs API key not configured" },
      { status: 500 },
    );
  }

  try {
    const client = new ElevenLabsClient({ apiKey });
    const tokenResponse = await client.tokens.singleUse.create(
      "realtime_scribe",
    );

    return NextResponse.json({ token: tokenResponse.token });
  } catch (error: any) {
    console.error("[ElevenLabs] Token generation failed:", error);
    return NextResponse.json(
      { error: "Failed to generate transcription token" },
      { status: 500 },
    );
  }
}
