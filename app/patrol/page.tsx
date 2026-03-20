"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Radio,
  MapPin,
  Navigation,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
} from "lucide-react";
import type { Patrol, Incident, IncidentSeverity } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function getSeverityVariant(severity: IncidentSeverity) {
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
}

export default function PatrolPage() {
  const [selectedPatrolId, setSelectedPatrolId] = useState<number | null>(null);

  const { data: patrols, mutate: mutatePatrols } = useSWR<Patrol[]>(
    "/api/patrols",
    fetcher,
    { refreshInterval: 3000 }
  );

  const { data: incidents } = useSWR<
    (Incident & { assigned_patrol_call_sign?: string })[]
  >("/api/incidents", fetcher, { refreshInterval: 3000 });

  // Find dispatched patrol and their assigned incident
  const dispatchedPatrols = patrols?.filter((p) => p.status === "dispatched") || [];
  const selectedPatrol = selectedPatrolId
    ? patrols?.find((p) => p.id === selectedPatrolId)
    : dispatchedPatrols[0];

  const assignedIncident = selectedPatrol
    ? incidents?.find((i) => i.assigned_patrol_id === selectedPatrol.id)
    : null;

  const handleAcknowledge = async () => {
    // In a real app, this would update the patrol status
    alert("Dispatch acknowledged. Proceeding to incident location.");
  };

  const handleComplete = async () => {
    if (!assignedIncident) return;

    // Mark incident as resolved and patrol as available
    try {
      // This would be a proper API call in production
      alert("Incident marked as resolved. Patrol returning to available status.");
      mutatePatrols();
    } catch (error) {
      console.error("Error completing incident:", error);
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
            <h1 className="text-xl font-semibold">Patrol Instructions</h1>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => mutatePatrols()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Link href="/dispatch">
              <Button variant="outline" size="sm">
                <MapPin className="w-4 h-4 mr-2" />
                View Map
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {dispatchedPatrols.length === 0 ? (
          /* No Active Dispatch */
          <Card className="max-w-lg mx-auto">
            <CardContent className="py-16 text-center">
              <Radio className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
              <h2 className="text-xl font-semibold mb-2">No Active Dispatch</h2>
              <p className="text-muted-foreground mb-6">
                You are currently not assigned to any incident. Stand by for dispatch.
              </p>
              <Link href="/transcribe">
                <Button>
                  <Radio className="w-4 h-4 mr-2" />
                  Process New Call
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Patrol Selector (if multiple dispatched) */}
            {dispatchedPatrols.length > 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Select Unit</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2 flex-wrap">
                    {dispatchedPatrols.map((patrol) => (
                      <Button
                        key={patrol.id}
                        variant={selectedPatrol?.id === patrol.id ? "default" : "outline"}
                        onClick={() => setSelectedPatrolId(patrol.id)}
                      >
                        {patrol.call_sign}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Current Assignment */}
            {selectedPatrol && (
              <Card className="border-warning/50">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-warning/20 flex items-center justify-center">
                      <Navigation className="w-6 h-6 text-warning" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">{selectedPatrol.call_sign}</CardTitle>
                      <p className="text-sm text-muted-foreground">Active Dispatch</p>
                    </div>
                  </div>
                  <Badge variant="warning" className="text-sm">
                    <Clock className="w-3 h-3 mr-1" />
                    En Route
                  </Badge>
                </CardHeader>
              </Card>
            )}

            {/* Incident Details */}
            {assignedIncident ? (
              <Card className="border-destructive/50">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center">
                        <AlertTriangle className="w-6 h-6 text-destructive" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Incident Details</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          ID: #{assignedIncident.id}
                        </p>
                      </div>
                    </div>
                    <Badge variant={getSeverityVariant(assignedIncident.severity)}>
                      {assignedIncident.severity.toUpperCase()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Description */}
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">
                      Description
                    </h4>
                    <p className="text-foreground text-lg">{assignedIncident.description}</p>
                  </div>

                  {/* Location */}
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">
                      Location
                    </h4>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-primary" />
                      <span className="font-mono">
                        {assignedIncident.latitude.toFixed(6)},{" "}
                        {assignedIncident.longitude.toFixed(6)}
                      </span>
                    </div>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${assignedIncident.latitude},${assignedIncident.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 mt-2 text-sm text-primary hover:underline"
                    >
                      <Navigation className="w-4 h-4" />
                      Open in Google Maps
                    </a>
                  </div>

                  {/* Transcript */}
                  {assignedIncident.transcript && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">
                        Call Transcript
                      </h4>
                      <div className="p-4 rounded-lg bg-secondary/50 border border-border">
                        <p className="text-sm text-foreground italic leading-relaxed">
                          &ldquo;{assignedIncident.transcript}&rdquo;
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-4 pt-4 border-t border-border">
                    <Button onClick={handleAcknowledge} className="flex-1">
                      <Radio className="w-4 h-4 mr-2" />
                      Acknowledge Dispatch
                    </Button>
                    <Button
                      onClick={handleComplete}
                      variant="success"
                      className="flex-1"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Mark Complete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">
                    Loading incident details...
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Safety Reminder */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-foreground mb-1">Safety Reminder</h4>
                    <p className="text-sm text-muted-foreground">
                      Assess the situation upon arrival. Request backup if needed. Prioritize
                      officer and civilian safety at all times.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </main>
  );
}
