"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Radio, MapPin, Users, AlertTriangle, RefreshCw, Play, Pause } from "lucide-react";
import type { Patrol, Incident, IncidentSeverity } from "@/lib/types";

const DispatchMap = dynamic(() => import("@/components/dispatch-map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-secondary/50 flex items-center justify-center">
      <p className="text-muted-foreground">Loading map...</p>
    </div>
  ),
});

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Helper to safely format coordinates (handles string/number from DB)
function formatCoord(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "N/A";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "N/A";
  return num.toFixed(4);
}

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

function getStatusVariant(status: string) {
  switch (status) {
    case "available":
      return "success";
    case "dispatched":
      return "warning";
    case "busy":
      return "secondary";
    default:
      return "secondary";
  }
}

function DispatchContent() {
  const searchParams = useSearchParams();
  const selectedIncidentId = searchParams.get("incidentId")
    ? parseInt(searchParams.get("incidentId")!)
    : undefined;
  const selectedPatrolId = searchParams.get("patrolId")
    ? parseInt(searchParams.get("patrolId")!)
    : undefined;

  const {
    data: patrols,
    error: patrolsError,
    mutate: mutatePatrols,
  } = useSWR<Patrol[]>("/api/patrols", fetcher, { refreshInterval: 5000 });

  const {
    data: incidents,
    error: incidentsError,
    mutate: mutateIncidents,
  } = useSWR<Incident[]>("/api/incidents", fetcher, { refreshInterval: 5000 });

  // Simulation state
  const [isSimulating, setIsSimulating] = useState(false);
  const simulationRef = useRef<NodeJS.Timeout | null>(null);

  // Run simulation - advances patrol positions along routes
  const runSimulation = async () => {
    try {
      console.log("[v0] Running simulation...");
      const res = await fetch("/api/simulate", { method: "POST" });
      const data = await res.json();
      console.log("[v0] Simulation response:", data);
      if (res.ok) {
        // Refresh data to show updated positions
        mutatePatrols();
        mutateIncidents();
      }
    } catch (error) {
      console.error("[v0] Simulation error:", error);
    }
  };

  // Toggle simulation on/off
  const toggleSimulation = () => {
    if (isSimulating) {
      if (simulationRef.current) {
        clearInterval(simulationRef.current);
        simulationRef.current = null;
      }
      setIsSimulating(false);
    } else {
      // Run immediately and then every 1000ms (5x faster than original 2000ms)
      runSimulation();
      simulationRef.current = setInterval(runSimulation, 1000);
      setIsSimulating(true);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (simulationRef.current) {
        clearInterval(simulationRef.current);
      }
    };
  }, []);

  const isLoading = !patrols || !incidents;
  const hasError = patrolsError || incidentsError;

  const availablePatrols = patrols?.filter((p) => p.status === "available").length || 0;
  const dispatchedPatrols = patrols?.filter((p) => p.status === "dispatched").length || 0;
  const activeIncidents = incidents?.filter((i) => i.status !== "resolved").length || 0;

  const handleRefresh = () => {
    mutatePatrols();
    mutateIncidents();
  };

  return (
    <main className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm flex-shrink-0 z-20">
        <div className="px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <h1 className="text-lg font-semibold">Emergency Dispatch Map</h1>
          </div>
          <div className="flex items-center gap-4">
            <Button 
              variant={isSimulating ? "destructive" : "default"} 
              size="sm" 
              onClick={toggleSimulation}
            >
              {isSimulating ? (
                <>
                  <Pause className="w-4 h-4 mr-2" />
                  Stop Simulation
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Start Simulation
                </>
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Link href="/transcribe">
              <Button size="sm">
                <Radio className="w-4 h-4 mr-2" />
                New Call
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-80 border-r border-border bg-card/30 flex flex-col overflow-hidden flex-shrink-0">
          {/* Stats */}
          <div className="p-4 border-b border-border">
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-2 rounded-lg bg-secondary/50">
                <p className="text-2xl font-bold text-success">{availablePatrols}</p>
                <p className="text-xs text-muted-foreground">Available</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-secondary/50">
                <p className="text-2xl font-bold text-warning">{dispatchedPatrols}</p>
                <p className="text-xs text-muted-foreground">Dispatched</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-secondary/50">
                <p className="text-2xl font-bold text-destructive">{activeIncidents}</p>
                <p className="text-xs text-muted-foreground">Incidents</p>
              </div>
            </div>
          </div>

          {/* Patrols List */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Patrol Units</h2>
              </div>
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : hasError ? (
                <p className="text-sm text-destructive">Error loading data</p>
              ) : (
                <div className="space-y-2">
                  {patrols?.map((patrol) => (
                    <Card
                      key={patrol.id}
                      className={`cursor-pointer transition-colors ${
                        patrol.id === selectedPatrolId
                          ? "border-primary bg-primary/10"
                          : "hover:bg-secondary/50"
                      }`}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-semibold">
                            {patrol.call_sign}
                          </span>
                          <Badge variant={getStatusVariant(patrol.status)} className="text-xs">
                            {patrol.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 font-mono">
                          {formatCoord(patrol.latitude)}, {formatCoord(patrol.longitude)}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Incidents List */}
            <div className="p-4 space-y-4 border-t border-border">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                <h2 className="text-sm font-semibold">Active Incidents</h2>
              </div>
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : incidents?.filter((i) => i.status !== "resolved").length === 0 ? (
                <p className="text-sm text-muted-foreground">No active incidents</p>
              ) : (
                <div className="space-y-2">
                  {incidents
                    ?.filter((i) => i.status !== "resolved")
                    .map((incident) => (
                      <Card
                        key={incident.id}
                        className={`cursor-pointer transition-colors ${
                          incident.id === selectedIncidentId
                            ? "border-destructive bg-destructive/10"
                            : "hover:bg-secondary/50"
                        }`}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium line-clamp-2">
                              {incident.description}
                            </p>
                            <Badge
                              variant={getSeverityVariant(incident.severity)}
                              className="text-xs flex-shrink-0"
                            >
                              {incident.severity}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                            <MapPin className="w-3 h-3" />
                            <span className="font-mono">
                              {formatCoord(incident.latitude)}, {formatCoord(incident.longitude)}
                            </span>
                          </div>
                          {(incident as Incident & { assigned_patrol_call_sign?: string })
                            .assigned_patrol_call_sign && (
                            <p className="text-xs text-primary mt-1">
                              Assigned:{" "}
                              {
                                (incident as Incident & { assigned_patrol_call_sign?: string })
                                  .assigned_patrol_call_sign
                              }
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Map */}
        <div className="flex-1 relative">
          {!isLoading && !hasError && (
            <DispatchMap
              patrols={patrols || []}
              incidents={incidents || []}
              selectedIncidentId={selectedIncidentId}
              selectedPatrolId={selectedPatrolId}
            />
          )}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background">
              <p className="text-muted-foreground">Loading map data...</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function DispatchPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center bg-background">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <DispatchContent />
    </Suspense>
  );
}
