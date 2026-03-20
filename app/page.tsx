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
              <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center">
                <Shield className="w-10 h-10 text-primary" />
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-success flex items-center justify-center">
                <Radio className="w-3 h-3 text-success-foreground" />
              </div>
            </div>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            Emergency Dispatch System
          </h1>
          <p className="text-lg text-muted-foreground max-w-md mx-auto text-pretty">
            AI-powered autonomous response system for emergency call processing and patrol dispatch
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-6 text-center space-y-2">
              <Radio className="w-8 h-8 mx-auto text-primary" />
              <p className="text-sm font-medium">Live Transcription</p>
              <p className="text-xs text-muted-foreground">Real-time audio processing</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-6 text-center space-y-2">
              <AlertTriangle className="w-8 h-8 mx-auto text-warning" />
              <p className="text-sm font-medium">AI Analysis</p>
              <p className="text-xs text-muted-foreground">Automatic threat assessment</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-6 text-center space-y-2">
              <MapPin className="w-8 h-8 mx-auto text-success" />
              <p className="text-sm font-medium">Smart Dispatch</p>
              <p className="text-xs text-muted-foreground">Nearest unit assignment</p>
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
