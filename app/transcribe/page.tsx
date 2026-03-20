"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Mic,
  Square,
  ArrowLeft,
  AlertTriangle,
  MapPin,
  Send,
  Loader2,
  Radio,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import type { IncidentSeverity } from "@/lib/types";

interface FormData {
  description: string;
  severity: IncidentSeverity | "";
  latitude: string;
  longitude: string;
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
  const [isDispatching, setIsDispatching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [lastAnalyzedLength, setLastAnalyzedLength] = useState(0);
  
  // Form state - editable by user
  const [formData, setFormData] = useState<FormData>({
    description: "",
    severity: "",
    latitude: "",
    longitude: "",
    suggestedActions: [],
  });
  
  const recognizerRef = useRef<import("microsoft-cognitiveservices-speech-sdk").SpeechRecognizer | null>(null);
  const analyzeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load Speech SDK on mount
  useEffect(() => {
    import("microsoft-cognitiveservices-speech-sdk").then((sdk) => {
      SpeechSDK = sdk;
    });
  }, []);

  // Auto-analyze when transcript changes (debounced)
  useEffect(() => {
    // Only auto-analyze if we have new significant content (at least 50 chars more than last analysis)
    if (transcript.length > lastAnalyzedLength + 50 && transcript.length > 30) {
      // Clear existing timeout
      if (analyzeTimeoutRef.current) {
        clearTimeout(analyzeTimeoutRef.current);
      }
      
      // Debounce analysis by 2 seconds after last transcript update
      analyzeTimeoutRef.current = setTimeout(() => {
        analyzeTranscript(transcript);
      }, 2000);
    }
    
    return () => {
      if (analyzeTimeoutRef.current) {
        clearTimeout(analyzeTimeoutRef.current);
      }
    };
  }, [transcript, lastAnalyzedLength]);

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
        const errorData = await tokenResponse.json();
        throw new Error(errorData.error || "Failed to get speech token");
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
      if (analyzeTimeoutRef.current) {
        clearTimeout(analyzeTimeoutRef.current);
      }
    };
  }, []);

  const analyzeTranscript = async (textToAnalyze: string) => {
    if (!textToAnalyze || textToAnalyze.length < 20) return;

    setIsAnalyzing(true);
    setError(null);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: textToAnalyze }),
      });

      if (response.ok) {
        const data = await response.json();
        // Update form data with AI analysis results
        setFormData({
          description: data.description || "",
          severity: data.severity || "",
          latitude: data.latitude?.toString() || "",
          longitude: data.longitude?.toString() || "",
          suggestedActions: data.suggestedActions || [],
        });
        setLastAnalyzedLength(textToAnalyze.length);
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

  const handleFormChange = (field: keyof FormData, value: string | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Validation - check if all required fields are filled
  const isFormValid = () => {
    return (
      formData.description.trim() !== "" &&
      formData.severity !== "" &&
      formData.latitude.trim() !== "" &&
      formData.longitude.trim() !== "" &&
      !isNaN(parseFloat(formData.latitude)) &&
      !isNaN(parseFloat(formData.longitude))
    );
  };

  const getMissingFields = (): string[] => {
    const missing: string[] = [];
    if (!formData.description.trim()) missing.push("Description");
    if (!formData.severity) missing.push("Severity");
    if (!formData.latitude.trim() || isNaN(parseFloat(formData.latitude))) missing.push("Latitude");
    if (!formData.longitude.trim() || isNaN(parseFloat(formData.longitude))) missing.push("Longitude");
    return missing;
  };

  const dispatchPatrol = async () => {
    if (!isFormValid()) return;

    setIsDispatching(true);
    setError(null);
    try {
      // First create the incident
      const incidentResponse = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: formData.description,
          latitude: parseFloat(formData.latitude),
          longitude: parseFloat(formData.longitude),
          severity: formData.severity,
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

  const getSeverityVariant = (severity: IncidentSeverity | "") => {
    switch (severity) {
      case "critical":
        return "critical";
      case "high":
        return "destructive";
      case "medium":
        return "warning";
      case "low":
        return "secondary";
      default:
        return "outline";
    }
  };

  const clearAll = () => {
    setTranscript("");
    setInterimTranscript("");
    setFormData({
      description: "",
      severity: "",
      latitude: "",
      longitude: "",
      suggestedActions: [],
    });
    setLastAnalyzedLength(0);
    setError(null);
  };

  const missingFields = getMissingFields();

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
            {isAnalyzing && (
              <Badge variant="secondary">
                <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                Analyzing...
              </Badge>
            )}
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
              </CardContent>
            </Card>

            {/* Transcript Display */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Transcript</CardTitle>
                {transcript && (
                  <Button variant="ghost" size="sm" onClick={clearAll}>
                    Clear All
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <div className="min-h-[200px] max-h-[400px] overflow-y-auto p-4 rounded-lg bg-secondary/50 border border-border">
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
                {transcript && (
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{transcript.split(" ").length} words</span>
                    {isAnalyzing ? (
                      <span className="flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        AI analyzing...
                      </span>
                    ) : lastAnalyzedLength > 0 ? (
                      <span className="flex items-center gap-1 text-green-600">
                        <CheckCircle2 className="w-3 h-3" />
                        AI analyzed
                      </span>
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Incident Form */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Incident Details</CardTitle>
                {isAnalyzing && (
                  <Badge variant="secondary">
                    <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                    Updating...
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Description */}
                <div>
                  <label className="text-sm font-medium text-foreground flex items-center gap-2 mb-2">
                    Description
                    {formData.description ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-destructive" />
                    )}
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleFormChange("description", e.target.value)}
                    placeholder="Describe the incident..."
                    className="w-full h-24 px-3 py-2 rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                </div>

                {/* Severity */}
                <div>
                  <label className="text-sm font-medium text-foreground flex items-center gap-2 mb-2">
                    Severity Level
                    {formData.severity ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-destructive" />
                    )}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {(["low", "medium", "high", "critical"] as const).map((level) => (
                      <button
                        key={level}
                        onClick={() => handleFormChange("severity", level)}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                          formData.severity === level
                            ? level === "critical"
                              ? "bg-red-600 text-white"
                              : level === "high"
                              ? "bg-orange-500 text-white"
                              : level === "medium"
                              ? "bg-yellow-500 text-black"
                              : "bg-green-600 text-white"
                            : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                        }`}
                      >
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Location */}
                <div>
                  <label className="text-sm font-medium text-foreground flex items-center gap-2 mb-2">
                    <MapPin className="w-4 h-4" />
                    Location Coordinates
                    {formData.latitude && formData.longitude && !isNaN(parseFloat(formData.latitude)) && !isNaN(parseFloat(formData.longitude)) ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-destructive" />
                    )}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <input
                        type="text"
                        value={formData.latitude}
                        onChange={(e) => handleFormChange("latitude", e.target.value)}
                        placeholder="Latitude (e.g., 51.5074)"
                        className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        value={formData.longitude}
                        onChange={(e) => handleFormChange("longitude", e.target.value)}
                        placeholder="Longitude (e.g., -0.1278)"
                        className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Suggested Actions */}
                {formData.suggestedActions.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      AI Suggested Actions
                    </label>
                    <ul className="space-y-2">
                      {formData.suggestedActions.map((action, index) => (
                        <li
                          key={index}
                          className="flex items-start gap-2 text-sm text-foreground bg-secondary/50 p-2 rounded"
                        >
                          <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center flex-shrink-0 text-xs">
                            {index + 1}
                          </span>
                          {action}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Dispatch Button */}
            <Card className={isFormValid() ? "border-primary/50" : "border-destructive/30"}>
              <CardContent className="pt-6">
                {missingFields.length > 0 && (
                  <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                    <p className="text-sm text-destructive flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Missing required fields: {missingFields.join(", ")}
                    </p>
                  </div>
                )}
                <Button
                  onClick={dispatchPatrol}
                  disabled={!isFormValid() || isDispatching}
                  size="lg"
                  className="w-full"
                  variant={formData.severity === "critical" ? "destructive" : "default"}
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
                  {isFormValid()
                    ? "Ready to dispatch - all required information provided"
                    : "Complete all fields above to enable dispatch"}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
