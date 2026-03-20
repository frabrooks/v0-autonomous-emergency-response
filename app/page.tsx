import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Radio, Shield, MapPin, AlertTriangle } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-background">
      <div className="max-w-2xl w-full space-y-8 text-center">
        {/* Logo and Title */}
        <div className="space-y-4">
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center shadow-lg">
                <Shield className="w-10 h-10 text-primary-foreground" />
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-success flex items-center justify-center shadow">
                <Radio className="w-3 h-3 text-success-foreground" />
              </div>
            </div>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            Emergency Dispatch System
          </h1>
          <p className="text-lg text-muted-foreground max-w-md mx-auto text-pretty">
            Autonomous response coordination for emergency call processing and patrol unit dispatch
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="bg-card border shadow-sm">
            <CardContent className="pt-6 text-center space-y-2">
              <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <Radio className="w-6 h-6 text-primary" />
              </div>
              <p className="text-sm font-semibold text-foreground">Live Transcription</p>
              <p className="text-xs text-muted-foreground">Real-time call processing</p>
            </CardContent>
          </Card>
          <Card className="bg-card border shadow-sm">
            <CardContent className="pt-6 text-center space-y-2">
              <div className="w-12 h-12 mx-auto rounded-full bg-warning/10 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-warning" />
              </div>
              <p className="text-sm font-semibold text-foreground">Incident Analysis</p>
              <p className="text-xs text-muted-foreground">Automatic severity assessment</p>
            </CardContent>
          </Card>
          <Card className="bg-card border shadow-sm">
            <CardContent className="pt-6 text-center space-y-2">
              <div className="w-12 h-12 mx-auto rounded-full bg-success/10 flex items-center justify-center">
                <MapPin className="w-6 h-6 text-success" />
              </div>
              <p className="text-sm font-semibold text-foreground">Unit Dispatch</p>
              <p className="text-xs text-muted-foreground">Nearest patrol assignment</p>
            </CardContent>
          </Card>
        </div>

        {/* CTA Button */}
        <div className="pt-4">
          <Link href="/transcribe">
            <Button size="xl" className="w-full max-w-sm">
              <Radio className="w-5 h-5 mr-2" />
              Begin Transcription
            </Button>
          </Link>
        </div>

        {/* Navigation Links */}
        <div className="flex items-center justify-center gap-6 pt-4">
          <Link 
            href="/dispatch" 
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            View Dispatch Map
          </Link>
          <span className="text-border">|</span>
          <Link 
            href="/patrol" 
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Patrol View
          </Link>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
          System Online
        </div>
      </div>
    </main>
  );
}
