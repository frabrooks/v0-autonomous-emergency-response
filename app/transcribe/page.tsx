"use client";

import { useState, useRef, useCallback } from "react";
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
} from "lucide-react";
import type { IncidentSeverity } from "@/lib/types";

interface Analysis {
  description: string;
  severity: IncidentSeverity;
  latitude: number;
  longitude: number;
  suggestedActions: string[];
}

export default function TranscribePage() {
  const router = useRouter();
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [isDispatching, setIsDispatching] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());

        // Transcribe the audio
        setIsTranscribing(true);
        try {
          const formData = new FormData();
          formData.append("audio", audioBlob, "recording.webm");

          const response = await fetch("/api/transcribe", {
            method: "POST",
            body: formData,
          });

          if (response.ok) {
            const data = await response.json();
            setTranscript((prev) => (prev ? prev + " " + data.text : data.text));
          }
        } catch (error) {
          console.error("Transcription error:", error);
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error starting recording:", error);
      alert("Could not access microphone. Please grant permission.");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const analyzeTranscript = async () => {
    if (!transcript) return;

    setIsAnalyzing(true);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });

      if (response.ok) {
        const data = await response.json();
        setAnalysis(data);
      }
    } catch (error) {
      console.error("Analysis error:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const dispatchPatrol = async () => {
    if (!analysis) return;

    setIsDispatching(true);
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
        // Navigate to dispatch map with the incident highlighted
        router.push(`/dispatch?incidentId=${incident.id}&patrolId=${dispatchData.patrol.id}`);
      } else {
        const error = await dispatchResponse.json();
        alert(error.error || "Dispatch failed");
      }
    } catch (error) {
      console.error("Dispatch error:", error);
      alert("Failed to dispatch patrol");
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
                <span className="w-2 h-2 rounded-full bg-white mr-2" />
                Recording
              </Badge>
            )}
            {isTranscribing && (
              <Badge variant="secondary">
                <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                Transcribing
              </Badge>
            )}
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column - Recording & Transcript */}
          <div className="space-y-6">
            {/* Recording Controls */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Audio Recording</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-center py-8">
                  <div className="relative">
                    {isRecording && (
                      <div className="absolute inset-0 rounded-full bg-destructive/30 animate-pulse-ring" />
                    )}
                    <button
                      onClick={isRecording ? stopRecording : startRecording}
                      disabled={isTranscribing}
                      className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all ${
                        isRecording
                          ? "bg-destructive hover:bg-destructive/90"
                          : "bg-primary hover:bg-primary/90"
                      } ${isTranscribing ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      {isRecording ? (
                        <Square className="w-10 h-10 text-destructive-foreground" />
                      ) : (
                        <Mic className="w-10 h-10 text-primary-foreground" />
                      )}
                    </button>
                  </div>
                </div>
                <p className="text-center text-sm text-muted-foreground">
                  {isRecording
                    ? "Click to stop recording"
                    : isTranscribing
                    ? "Processing audio..."
                    : "Click to start recording emergency call"}
                </p>
              </CardContent>
            </Card>

            {/* Transcript Display */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Transcript</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="min-h-[200px] p-4 rounded-lg bg-secondary/50 border border-border">
                  {transcript ? (
                    <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                      {transcript}
                    </p>
                  ) : (
                    <p className="text-muted-foreground italic">
                      Transcript will appear here after recording...
                    </p>
                  )}
                </div>
                {transcript && !analysis && (
                  <Button
                    onClick={analyzeTranscript}
                    disabled={isAnalyzing}
                    className="w-full mt-4"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Analyzing...
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
                    Record an emergency call and click analyze to see incident details
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
