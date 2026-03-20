"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Radio,
  MapPin,
  Navigation,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  User,
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

function formatCoordinate(value: number | null | undefined): string {
  if (value === null || value === undefined) return "N/A";
  const num = Number(value);
  if (isNaN(num)) return "N/A";
  return num.toFixed(6);
}

export default function PatrolPage() {
  const [selectedPatrolId, setSelectedPatrolId] = useState<number | null>(null);
  const [isPatrolSelected, setIsPatrolSelected] = useState(false);

  // Fetch all patrols for selection
  const { data: patrols, mutate: mutatePatrols } = useSWR<Patrol[]>(
    "/api/patrols",
    fetcher,
    { refreshInterval: isPatrolSelected ? 1000 : 5000 } // Poll faster once patrol is selected
  );

  // Fetch incidents, polling every second once a patrol is selected
  const { data: incidents, mutate: mutateIncidents } = useSWR<
    (Incident & { assigned_patrol_call_sign?: string })[]
  >("/api/incidents", fetcher, { refreshInterval: isPatrolSelected ? 1000 : 5000 });

  // Get the selected patrol
  const selectedPatrol = selectedPatrolId
    ? patrols?.find((p) => p.id === selectedPatrolId)
    : null;

  // Find incident assigned to selected patrol
  const assignedIncident = selectedPatrol
    ? incidents?.find((i) => i.assigned_patrol_id === selectedPatrol.id)
    : null;

  // Check if patrol has an active dispatch
  const isDispatched = selectedPatrol?.status === "dispatched";

  const handleSelectPatrol = (patrolId: string) => {
    setSelectedPatrolId(Number(patrolId));
    setIsPatrolSelected(true);
  };

  const handleAcknowledge = async () => {
    // In a real app, this would update the patrol status
    alert("Dispatch acknowledged. Proceeding to incident location.");
  };

  const handleComplete = async () => {
    if (!assignedIncident || !selectedPatrol) return;

    try {
      // Mark incident as resolved
      await fetch(`/api/incidents/${assignedIncident.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "resolved" }),
      });

      // Mark patrol as available
      await fetch(`/api/patrols/${selectedPatrol.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "available" }),
      });

      alert("Incident marked as resolved. Patrol returning to available status.");
      mutatePatrols();
      mutateIncidents();
    } catch (error) {
      console.error("Error completing incident:", error);
    }
  };

  // Show patrol selection if no patrol is selected
  if (!isPatrolSelected) {
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
              <h1 className="text-xl font-semibold">Patrol Unit Login</h1>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-8">
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Select Your Patrol Unit
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground text-sm">
                Select your patrol unit to receive dispatch assignments and incident details.
              </p>
              <Select onValueChange={handleSelectPatrol}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose patrol unit..." />
                </SelectTrigger>
                <SelectContent>
                  {patrols?.map((patrol) => (
                    <SelectItem key={patrol.id} value={patrol.id.toString()}>
                      <span className="flex items-center gap-2">
                        {patrol.call_sign}
                        <Badge
                          variant={
                            patrol.status === "available"
                              ? "success"
                              : patrol.status === "dispatched"
                              ? "warning"
                              : "secondary"
                          }
                          className="ml-2"
                        >
                          {patrol.status}
                        </Badge>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setIsPatrolSelected(false);
                setSelectedPatrolId(null);
              }}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-semibold">
              {selectedPatrol?.call_sign || "Patrol"} - Instructions
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <Badge
              variant={
                selectedPatrol?.status === "available"
                  ? "success"
                  : selectedPatrol?.status === "dispatched"
                  ? "warning"
                  : "secondary"
              }
            >
              {selectedPatrol?.status?.toUpperCase() || "UNKNOWN"}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                mutatePatrols();
                mutateIncidents();
              }}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {!isDispatched ? (
          /* No Active Dispatch */
          <Card className="max-w-lg mx-auto">
            <CardContent className="py-16 text-center">
              <Radio className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
              <h2 className="text-xl font-semibold mb-2">Standing By</h2>
              <p className="text-muted-foreground mb-2">
                Unit {selectedPatrol?.call_sign} is currently available.
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                Polling for new dispatch assignments...
              </p>
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                Connected - Auto-refreshing every second
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Current Assignment */}
            <Card className="border-warning/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-warning/20 flex items-center justify-center">
                    <Navigation className="w-6 h-6 text-warning" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">
                      {selectedPatrol?.call_sign}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">Active Dispatch</p>
                  </div>
                </div>
                <Badge variant="warning" className="text-sm">
                  <Clock className="w-3 h-3 mr-1" />
                  En Route
                </Badge>
              </CardHeader>
            </Card>

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
                      {assignedIncident.severity?.toUpperCase() || "UNKNOWN"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Description */}
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">
                      Description
                    </h4>
                    <p className="text-foreground text-lg">
                      {assignedIncident.description || "No description available"}
                    </p>
                  </div>

                  {/* Location */}
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">
                      Location
                    </h4>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-primary" />
                      <span className="font-mono">
                        {formatCoordinate(assignedIncident.latitude)},{" "}
                        {formatCoordinate(assignedIncident.longitude)}
                      </span>
                    </div>
                    {assignedIncident.latitude && assignedIncident.longitude && (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${assignedIncident.latitude},${assignedIncident.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 mt-2 text-sm text-primary hover:underline"
                      >
                        <Navigation className="w-4 h-4" />
                        Open in Google Maps
                      </a>
                    )}
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
