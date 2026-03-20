"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
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
  Shield,
} from "lucide-react";
import type { Patrol, Incident, IncidentSeverity } from "@/lib/types";

const PatrolMiniMap = dynamic(() => import("@/components/patrol-mini-map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-64 bg-secondary/50 rounded-lg flex items-center justify-center">
      <p className="text-muted-foreground">Loading map...</p>
    </div>
  ),
});

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

function getStatusBadge(status: Patrol["status"]) {
  switch (status) {
    case "available":
      return { variant: "secondary" as const, label: "Available" };
    case "dispatched":
      return { variant: "warning" as const, label: "Dispatched" };
    case "busy":
      return { variant: "destructive" as const, label: "Busy" };
  }
}

export default function PatrolPage() {
  const [selectedPatrolId, setSelectedPatrolId] = useState<string>("");
  const [isSimulating, setIsSimulating] = useState(false);
  const simulationRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch all patrols for the select dropdown
  const { data: patrols } = useSWR<Patrol[]>("/api/patrols", fetcher);

  // Poll for the selected patrol's data every 1 second
  const { data: patrolData, mutate: mutatePatrol } = useSWR<Patrol>(
    selectedPatrolId ? `/api/patrols/${selectedPatrolId}` : null,
    fetcher,
    { refreshInterval: 1000 }
  );

  // Poll for incident assigned to this patrol (via assigned_patrol_id on incident)
  const { data: assignedIncident } = useSWR<Incident | null>(
    selectedPatrolId ? `/api/patrols/${selectedPatrolId}/incident` : null,
    fetcher,
    { refreshInterval: 1000 }
  );

  const selectedPatrol = patrolData;

  // Run simulation - advances patrol positions along routes
  const runSimulation = async () => {
    try {
      const res = await fetch("/api/simulate", { method: "POST" });
      if (res.ok) {
        // Refresh patrol data to show updated position
        mutatePatrol();
      }
    } catch (error) {
      console.error("Simulation error:", error);
    }
  };

  // Cleanup simulation on unmount
  useEffect(() => {
    return () => {
      if (simulationRef.current) {
        clearInterval(simulationRef.current);
      }
    };
  }, []);

  const handleAcknowledge = async () => {
    if (isSimulating) {
      // Stop simulation
      if (simulationRef.current) {
        clearInterval(simulationRef.current);
        simulationRef.current = null;
      }
      setIsSimulating(false);
    } else {
      // Start simulation - run immediately and then every 1000ms
      runSimulation();
      simulationRef.current = setInterval(runSimulation, 1000);
      setIsSimulating(true);
    }
  };

  const handleComplete = async () => {
    if (!assignedIncident) return;

    // Mark incident as resolved and patrol as available
    try {
      // This would be a proper API call in production
      alert("Incident marked as resolved. Patrol returning to available status.");
      mutatePatrol();
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
        {/* Patrol Selector */}
        <Card className="max-w-2xl mx-auto mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Select Your Patrol Unit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              value={selectedPatrolId}
              onValueChange={setSelectedPatrolId}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a patrol unit..." />
              </SelectTrigger>
              <SelectContent>
                {patrols?.map((patrol) => {
                  const statusInfo = getStatusBadge(patrol.status);
                  return (
                    <SelectItem key={patrol.id} value={patrol.id.toString()}>
                      <span className="flex items-center gap-2">
                        {patrol.call_sign} - {statusInfo.label}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {selectedPatrolId && (
              <p className="text-xs text-muted-foreground mt-2">
                Polling for case assignment every 1 second...
              </p>
            )}
          </CardContent>
        </Card>

        {!selectedPatrolId ? (
          /* No Patrol Selected */
          <Card className="max-w-lg mx-auto">
            <CardContent className="py-16 text-center">
              <Radio className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
              <h2 className="text-xl font-semibold mb-2">Select a Patrol Unit</h2>
              <p className="text-muted-foreground">
                Choose your patrol unit from the dropdown above to receive dispatch instructions.
              </p>
            </CardContent>
          </Card>
        ) : selectedPatrol && assignedIncident ? (
          /* Active Dispatch */
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Current Assignment */}
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

            {/* Route Map */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Route to Incident
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 rounded-lg overflow-hidden border border-border">
                  <PatrolMiniMap
                    patrol={selectedPatrol}
                    incident={assignedIncident}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Dashed line shows route from your position to incident location
                </p>
              </CardContent>
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
                    <Button 
                      onClick={handleAcknowledge} 
                      variant={isSimulating ? "destructive" : "default"}
                      className="flex-1"
                    >
                      <Radio className="w-4 h-4 mr-2" />
                      {isSimulating ? "Stop Simulation" : "Acknowledge Dispatch"}
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
        ) : selectedPatrol ? (
          /* No Active Dispatch for selected patrol */
          <Card className="max-w-lg mx-auto">
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold mb-2">{selectedPatrol.call_sign}</h2>
              <Badge variant={getStatusBadge(selectedPatrol.status).variant} className="mb-4">
                {getStatusBadge(selectedPatrol.status).label}
              </Badge>
              <p className="text-muted-foreground mb-6">
                No active dispatch assigned. Standing by for instructions.
              </p>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Checking for assignments...</span>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Loading */
          <Card className="max-w-lg mx-auto">
            <CardContent className="py-16 text-center">
              <RefreshCw className="w-8 h-8 mx-auto text-muted-foreground animate-spin mb-4" />
              <p className="text-muted-foreground">Loading patrol data...</p>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
