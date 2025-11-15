import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Clock, Coffee, MapPin, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useSoundEffects } from "@/hooks/useSoundEffects";
import { useGamification } from "@/hooks/useGamification";

interface ClockEntry {
  id: string;
  clock_in: string;
  clock_out: string | null;
  break_start: string | null;
  break_end: string | null;
  location_lat: number | null;
  location_lng: number | null;
  last_location_update: string | null;
  notes: string | null;
}

interface Location {
  lat: number;
  lng: number;
  accuracy: number;
}

const ClockButton = () => {
  const [activeEntry, setActiveEntry] = useState<ClockEntry | null>(null);
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [showNotesDialog, setShowNotesDialog] = useState(false);
  const [notesAction, setNotesAction] = useState<"clock-in" | "clock-out" | "break-start" | "break-end" | null>(null);
  const [notes, setNotes] = useState("");
  const locationIntervalRef = useRef<number | null>(null);
  const { toast } = useToast();
  const { playSound } = useSoundEffects();
  const gamification = useGamification();

  const triggerHaptic = (type: 'light' | 'medium' | 'heavy' = 'medium') => {
    if ('vibrate' in navigator) {
      const patterns = {
        light: 10,
        medium: 20,
        heavy: [30, 10, 30]
      };
      navigator.vibrate(patterns[type]);
    }
  };

  useEffect(() => {
    checkActiveEntry();
    requestLocationPermission();
  }, []);

  useEffect(() => {
    if (activeEntry && !isOnBreak) {
      startLocationTracking();
    } else {
      stopLocationTracking();
    }
    return () => stopLocationTracking();
  }, [activeEntry, isOnBreak]);

  const requestLocationPermission = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation not supported");
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setLocationError(null);
      },
      (error) => {
        setLocationError(error.message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const getCurrentLocation = (): Promise<Location> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation not supported"));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
          };
          setCurrentLocation(location);
          resolve(location);
        },
        (error) => {
          setLocationError(error.message);
          reject(error);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  };

  const startLocationTracking = () => {
    stopLocationTracking();
    
    locationIntervalRef.current = window.setInterval(async () => {
      try {
        const location = await getCurrentLocation();
        if (activeEntry) {
          await supabase
            .from("clock_entries")
            .update({
              location_lat: location.lat,
              location_lng: location.lng,
              last_location_update: new Date().toISOString(),
            })
            .eq("id", activeEntry.id);
        }
      } catch (error) {
        console.error("Location tracking error:", error);
      }
    }, 60000); // Update every minute
  };

  const stopLocationTracking = () => {
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  };

  const checkActiveEntry = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("clock_entries")
      .select("*")
      .eq("user_id", user.id)
      .is("clock_out", null)
      .order("clock_in", { ascending: false })
      .limit(1)
      .single();

    if (!error && data) {
      setActiveEntry(data);
      setIsOnBreak(data.break_start && !data.break_end);
    }
  };

  const handleClockIn = async (noteText?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setIsGettingLocation(true);
    
    try {
      const location = await getCurrentLocation();
      
      // Check for nearby jobs (geofence validation)
      const { data: todaysJobs } = await supabase
        .from("jobs")
        .select("*")
        .eq("assigned_to", user.id)
        .gte("scheduled_start", new Date().toISOString().split("T")[0]);

      let nearbyJob = null;
      let warningMessage = "";

      // Note: In production, you'd geocode customer_address to get lat/lng
      // For now, we'll just show a warning if no location
      if (location.accuracy > 100) {
        warningMessage = "Location accuracy is low. ";
      }

      const { error } = await supabase.from("clock_entries").insert({
        user_id: user.id,
        clock_in: new Date().toISOString(),
        location_lat: location.lat,
        location_lng: location.lng,
        last_location_update: new Date().toISOString(),
        notes: noteText || null,
      });

      if (error) {
        playSound('error');
        triggerHaptic('heavy');
        toast({
          title: "Error",
          description: "Failed to clock in",
          variant: "destructive",
        });
        return;
      }

      // Success feedback
      playSound('success');
      triggerHaptic('medium');
      
      // Update gamification
      const now = new Date();
      const scheduledTime = todaysJobs?.[0]?.scheduled_start ? new Date(todaysJobs[0].scheduled_start) : null;
      const isOnTime = scheduledTime ? now <= scheduledTime : true;
      
      if (isOnTime) {
        const result = gamification.addXP(10);
        if (result.leveledUp) {
          playSound('levelUp');
          toast({
            title: "🎉 Level Up!",
            description: `You've reached level ${result.newLevel}!`,
          });
        }
      }
      
      gamification.updateStreak();

      toast({
        title: "✅ Clocked in",
        description: `${warningMessage}Clocked in at ${format(new Date(), "h:mm a")}${isOnTime ? ' +10 XP!' : ''}`,
      });
      checkActiveEntry();
      setShowNotesDialog(false);
      setNotes("");
    } catch (error) {
      playSound('error');
      triggerHaptic('heavy');
      toast({
        title: "Location Required",
        description: "Please enable location services to clock in",
        variant: "destructive",
      });
    } finally {
      setIsGettingLocation(false);
    }
  };

  const handleClockOut = async (noteText?: string) => {
    if (!activeEntry) return;

    const updateData: any = { 
      clock_out: new Date().toISOString() 
    };
    
    if (noteText) {
      updateData.notes = activeEntry.notes 
        ? `${activeEntry.notes}\n\nClock Out: ${noteText}`
        : `Clock Out: ${noteText}`;
    }

    const { error } = await supabase
      .from("clock_entries")
      .update(updateData)
      .eq("id", activeEntry.id);

    if (error) {
      playSound('error');
      triggerHaptic('heavy');
      toast({
        title: "Error",
        description: "Failed to clock out",
        variant: "destructive",
      });
      return;
    }

    // Success feedback
    playSound('success');
    triggerHaptic('medium');

    toast({
      title: "👋 Clocked out",
      description: `See you tomorrow! Clocked out at ${format(new Date(), "h:mm a")}`,
    });
    setActiveEntry(null);
    setIsOnBreak(false);
    setShowNotesDialog(false);
    setNotes("");
  };

  const handleBreak = async (noteText?: string) => {
    if (!activeEntry) return;

    if (isOnBreak) {
      const updateData: any = { 
        break_end: new Date().toISOString() 
      };
      
      if (noteText) {
        updateData.notes = activeEntry.notes 
          ? `${activeEntry.notes}\n\nBreak End: ${noteText}`
          : `Break End: ${noteText}`;
      }

      const { error } = await supabase
        .from("clock_entries")
        .update(updateData)
        .eq("id", activeEntry.id);

      if (error) {
        playSound('error');
        triggerHaptic('heavy');
        toast({
          title: "Error",
          description: "Failed to end break",
          variant: "destructive",
        });
        return;
      }

      playSound('success');
      triggerHaptic('light');
      toast({
        title: "💪 Break ended",
        description: "Back to work!",
      });
      setIsOnBreak(false);
      setShowNotesDialog(false);
      setNotes("");
    } else {
      const updateData: any = { 
        break_start: new Date().toISOString() 
      };
      
      if (noteText) {
        updateData.notes = activeEntry.notes 
          ? `${activeEntry.notes}\n\nBreak Start: ${noteText}`
          : `Break Start: ${noteText}`;
      }

      const { error } = await supabase
        .from("clock_entries")
        .update(updateData)
        .eq("id", activeEntry.id);

      if (error) {
        playSound('error');
        triggerHaptic('heavy');
        toast({
          title: "Error",
          description: "Failed to start break",
          variant: "destructive",
        });
        return;
      }

      playSound('click');
      triggerHaptic('light');
      toast({
        title: "☕ Break started",
        description: "Enjoy your break!",
      });
      setIsOnBreak(true);
      setShowNotesDialog(false);
      setNotes("");
    }
  };

  const openNotesDialog = (action: "clock-in" | "clock-out" | "break-start" | "break-end") => {
    setNotesAction(action);
    setShowNotesDialog(true);
  };

  const handleNotesSubmit = () => {
    if (notesAction === "clock-in") {
      handleClockIn(notes);
    } else if (notesAction === "clock-out") {
      handleClockOut(notes);
    } else if (notesAction === "break-start") {
      handleBreak(notes);
    } else if (notesAction === "break-end") {
      handleBreak(notes);
    }
  };

  const handleSkipNotes = () => {
    if (notesAction === "clock-in") {
      handleClockIn();
    } else if (notesAction === "clock-out") {
      handleClockOut();
    } else if (notesAction === "break-start") {
      handleBreak();
    } else if (notesAction === "break-end") {
      handleBreak();
    }
  };

  if (!activeEntry) {
    return (
      <>
        <div className="space-y-3">
          <Button 
            onClick={() => openNotesDialog("clock-in")} 
            size="lg" 
            className="w-full h-16 text-lg font-bold hover:scale-105 transition-all shadow-lg hover:shadow-xl animate-pulse-glow"
            disabled={isGettingLocation}
          >
            <Clock className="mr-2 h-6 w-6" />
            {isGettingLocation ? "🔍 Getting Location..." : "🚀 Clock In"}
          </Button>
          
          {currentLocation && (
            <div className="flex items-center justify-center gap-2 text-sm text-success font-medium glass p-2 rounded-lg">
              <MapPin className="h-4 w-4" />
              <span>✅ Location ready (±{Math.round(currentLocation.accuracy)}m)</span>
            </div>
          )}
          
          {locationError && (
            <div className="flex items-center justify-center gap-2 text-sm text-destructive glass p-2 rounded-lg animate-shake">
              <AlertCircle className="h-4 w-4" />
              <span>{locationError}</span>
            </div>
          )}
        </div>

        <Dialog open={showNotesDialog} onOpenChange={setShowNotesDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {notesAction === "clock-in" && "Clock In"}
                {notesAction === "clock-out" && "Clock Out"}
                {notesAction === "break-start" && "Start Break"}
                {notesAction === "break-end" && "End Break"}
              </DialogTitle>
              <DialogDescription>
                Add an optional note (e.g., "Running late due to traffic")
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any notes here..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={handleSkipNotes}>
                Skip
              </Button>
              <Button onClick={handleNotesSubmit}>
                Confirm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex gap-3">
          <Button
            onClick={() => openNotesDialog(isOnBreak ? "break-end" : "break-start")}
            variant={isOnBreak ? "default" : "outline"}
            className="flex-1 h-14 text-base font-semibold hover:scale-105 transition-transform"
          >
            <Coffee className="mr-2 h-5 w-5" />
            {isOnBreak ? "☕ End Break" : "☕ Start Break"}
          </Button>
          <Button 
            onClick={() => openNotesDialog("clock-out")} 
            variant="destructive" 
            className="flex-1 h-14 text-base font-semibold hover:scale-105 transition-transform shadow-lg"
          >
            <Clock className="mr-2 h-5 w-5" />
            👋 Clock Out
          </Button>
        </div>
        
        {currentLocation && (
          <div className="flex items-center justify-center gap-2 text-sm text-success font-medium glass p-2 rounded-lg">
            <MapPin className="h-4 w-4" />
            <span>
              📍 Tracking location • Last update: {activeEntry.last_location_update 
                ? format(new Date(activeEntry.last_location_update), "h:mm a")
                : "Now"}
            </span>
          </div>
        )}
      </div>

      <Dialog open={showNotesDialog} onOpenChange={setShowNotesDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {notesAction === "clock-in" && "Clock In"}
              {notesAction === "clock-out" && "Clock Out"}
              {notesAction === "break-start" && "Start Break"}
              {notesAction === "break-end" && "End Break"}
            </DialogTitle>
            <DialogDescription>
              Add an optional note (e.g., "Took extended lunch break")
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes here..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleSkipNotes}>
              Skip
            </Button>
            <Button onClick={handleNotesSubmit}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ClockButton;