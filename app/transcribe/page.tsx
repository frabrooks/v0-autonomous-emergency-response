"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Mic,
  MicOff,
  Square,
  ArrowLeft,
  AlertTriangle,
  MapPin,
  Send,
  Loader2,
  Radio,
} from "lucide-react";
import type { IncidentSeverity } from "@/lib/types";

interface Analysis {
  description: string;
  severity: IncidentSeverity;
  latitude: number;
  longitude: number;
  suggestedActions: string[];
}

// Import Speech SDK dynamically to avoid SSR issues
let SpeechSDK: typeof import("microsoft-cognitiveservices-speech-sdk") | null = null;

export default function TranscribePage() {
  const router = useRouter();
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [isDispatching, setIsDispatching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  
  const recognizerRef = useRef<import("microsoft-cognitiveservices-speech-sdk").SpeechRecognizer | null>(null);

  // Load Speech SDK on mount
  useEffect(() => {
    import("microsoft-cognitiveservices-speech-sdk").then((sdk) => {
      SpeechSDK = sdk;
    });
  }, []);

  const startRecording = useCallback(async () => {
    if (!SpeechSDK) {
      setError("Speech SDK not loaded yet. Please try again.");
      return;
    }

    setIsInitializing(true);
    setError(null);

    try {
      // Get token from our API
      const tokenResponse = await fetch("/api/speech-token");
      if (!tokenResponse.ok) {
        throw new Error("Failed to get speech token");
      }
      const { token, region } = await tokenResponse.json();

      // Create speech config with token
      const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(token, region);
      speechConfig.speechRecognitionLanguage = "en-GB"; // UK English for 999 calls
      
      // Enable interim results for real-time feedback
      speechConfig.setProperty(
        SpeechSDK.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs,
        "15000"
      );
      speechConfig.setProperty(
        SpeechSDK.PropertyId.SpeechServiceConnection_EndSilenceTimeoutMs,
        "5000"
      );

      // Create audio config from microphone
      const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();

      // Create recognizer
      const recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);
      recognizerRef.current = recognizer;

      // Handle recognizing event (interim results)
      recognizer.recognizing = (_sender, event) => {
        if (event.result.reason === SpeechSDK!.ResultReason.RecognizingSpeech) {
          setInterimTranscript(event.result.text);
        }
      };

      // Handle recognized event (final results)
      recognizer.recognized = (_sender, event) => {
        if (event.result.reason === SpeechSDK!.ResultReason.RecognizedSpeech) {
          const text = event.result.text;
          if (text) {
            setTranscript((prev) => (prev ? prev + " " + text : text));
            setInterimTranscript("");
          }
        } else if (event.result.reason === SpeechSDK!.ResultReason.NoMatch) {
          console.log("No speech recognized");
        }
      };

      // Handle errors
      recognizer.canceled = (_sender, event) => {
        if (event.reason === SpeechSDK!.CancellationReason.Error) {
          console.error("Speech recognition error:", event.errorDetails);
          setError(`Recognition error: ${event.errorDetails}`);
        }
        stopRecording();
      };

      recognizer.sessionStopped = () => {
        stopRecording();
      };

      // Start continuous recognition
      await recognizer.startContinuousRecognitionAsync();
      setIsRecording(true);
      setIsInitializing(false);
    } catch (err) {
      console.error("Error starting recognition:", err);
      setError(err instanceof Error ? err.message : "Failed to start recording");
      setIsInitializing(false);
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (recognizerRef.current) {
      try {
        await recognizerRef.current.stopContinuousRecognitionAsync();
        recognizerRef.current.close();
        recognizerRef.current = null;
      } catch (err) {
        console.error("Error stopping recognition:", err);
      }
    }
    setIsRecording(false);
    setInterimTranscript("");
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognizerRef.current) {
        recognizerRef.current.close();
      }
    };
  }, []);

  const analyzeTranscript = async () => {
    if (!transcript) return;

    setIsAnalyzing(true);
    setError(null);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });

      if (response.ok) {
        const data = await response.json();
        setAnalysis(data);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Analysis failed");
      }
    } catch (err) {
      console.error("Analysis error:", err);
      setError("Failed to analyze transcript");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const dispatchPatrol = async () => {
    if (!analysis) return;

    setIsDispatching(true);
    setError(null);
    try {
      // First create the incident
      const incidentResponse = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: analysis.description,
          latitude: analysis.latitude,
          longitude: analysis.longitude,
          severity: analysis.severity,
          transcript,
        }),
      });

      if (!incidentResponse.ok) {
        throw new Error("Failed to create incident");
      }

      const incident = await incidentResponse.json();

      // Then dispatch the nearest patrol
      const dispatchResponse = await fetch("/api/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incidentId: incident.id }),
      });

      if (dispatchResponse.ok) {
        const dispatchData = await dispatchResponse.json();
        router.push(`/dispatch?incidentId=${incident.id}&patrolId=${dispatchData.patrol.id}`);
      } else {
        const errorData = await dispatchResponse.json();
        setError(errorData.error || "Dispatch failed");
      }
    } catch (err) {
      console.error("Dispatch error:", err);
      setError("Failed to dispatch patrol");
    } finally {
      setIsDispatching(false);
    }
  };

  const getSeverityVariant = (severity: IncidentSeverity) => {
    switch (severity) {
      case "critical":
        return "critical";
      case "high":
        return "destructive";
      case "medium":
        return "warning";
      case "low":
        return "secondary";
    }
  };

  const clearTranscript = () => {
    setTranscript("");
    setInterimTranscript("");
    setAnalysis(null);
    setError(null);
  };

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <h1 className="text-xl font-semibold">Emergency Call Transcription</h1>
          </div>
          <div className="flex items-center gap-2">
            {isRecording && (
              <Badge variant="destructive" className="animate-pulse">
                <Radio className="w-3 h-3 mr-2" />
                LIVE
              </Badge>
            )}
            {isInitializing && (
              <Badge variant="secondary">
                <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                Connecting...
              </Badge>
            )}
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive">
            {error}
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column - Recording & Transcript */}
          <div className="space-y-6">
            {/* Recording Controls */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Live Audio Transcription</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-center py-8">
                  <div className="relative">
                    {isRecording && (
                      <>
                        <div className="absolute inset-0 rounded-full bg-destructive/30 animate-ping" />
                        <div className="absolute inset-0 rounded-full bg-destructive/20 animate-pulse" />
                      </>
                    )}
                    <button
                      onClick={isRecording ? stopRecording : startRecording}
                      disabled={isInitializing}
                      className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all ${
                        isRecording
                          ? "bg-destructive hover:bg-destructive/90"
                          : "bg-primary hover:bg-primary/90"
                      } ${isInitializing ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      {isRecording ? (
                        <Square className="w-10 h-10 text-destructive-foreground" />
                      ) : isInitializing ? (
                        <Loader2 className="w-10 h-10 text-primary-foreground animate-spin" />
                      ) : (
                        <Mic className="w-10 h-10 text-primary-foreground" />
                      )}
                    </button>
                  </div>
                </div>
                <p className="text-center text-sm text-muted-foreground">
                  {isRecording
                    ? "Transcribing in real-time... Click to stop"
                    : isInitializing
                    ? "Connecting to Azure Speech Services..."
                    : "Click to start live transcription"}
                </p>
                <p className="text-center text-xs text-muted-foreground">
                  Powered by Azure Speech Services (UK English)
                </p>
              </CardContent>
            </Card>

            {/* Transcript Display */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Transcript</CardTitle>
                {transcript && (
                  <Button variant="ghost" size="sm" onClick={clearTranscript}>
                    Clear
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <div className="min-h-[200px] p-4 rounded-lg bg-secondary/50 border border-border">
                  {transcript || interimTranscript ? (
                    <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                      {transcript}
                      {interimTranscript && (
                        <span className="text-muted-foreground italic">
                          {transcript ? " " : ""}{interimTranscript}
                        </span>
                      )}
                    </p>
                  ) : (
                    <p className="text-muted-foreground italic">
                      Transcript will appear here in real-time as you speak...
                    </p>
                  )}
                </div>
                {transcript && !analysis && (
                  <Button
                    onClick={analyzeTranscript}
                    disabled={isAnalyzing || isRecording}
                    className="w-full mt-4"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Analyzing with Azure OpenAI...
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        Analyze Incident
                      </>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Analysis & Dispatch */}
          <div className="space-y-6">
            {analysis ? (
              <>
                {/* Incident Analysis */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg">Incident Analysis</CardTitle>
                    <Badge variant={getSeverityVariant(analysis.severity)}>
                      {analysis.severity.toUpperCase()}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">
                        Description
                      </h4>
                      <p className="text-foreground">{analysis.description}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">
                        Estimated Location
                      </h4>
                      <div className="flex items-center gap-2 text-foreground">
                        <MapPin className="w-4 h-4 text-primary" />
                        <span className="font-mono text-sm">
                          {analysis.latitude.toFixed(6)}, {analysis.longitude.toFixed(6)}
                        </span>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">
                        Suggested Actions
                      </h4>
                      <ul className="space-y-2">
                        {analysis.suggestedActions.map((action, index) => (
                          <li
                            key={index}
                            className="flex items-start gap-2 text-sm text-foreground"
                          >
                            <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center flex-shrink-0 text-xs">
                              {index + 1}
                            </span>
                            {action}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>

                {/* Dispatch Action */}
                <Card className="border-primary/50">
                  <CardContent className="pt-6">
                    <Button
                      onClick={dispatchPatrol}
                      disabled={isDispatching}
                      size="lg"
                      className="w-full"
                      variant={analysis.severity === "critical" ? "destructive" : "default"}
                    >
                      {isDispatching ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Dispatching Nearest Unit...
                        </>
                      ) : (
                        <>
                          <Send className="w-5 h-5 mr-2" />
                          Dispatch Nearest Patrol
                        </>
                      )}
                    </Button>
                    <p className="text-center text-sm text-muted-foreground mt-3">
                      This will automatically assign the nearest available patrol unit
                    </p>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-16 text-center">
                  <AlertTriangle className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium text-muted-foreground mb-2">
                    No Analysis Yet
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Start recording an emergency call - transcript appears in real-time.
                    <br />
                    When ready, click analyze to extract incident details.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
