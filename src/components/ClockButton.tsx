import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Clock, Coffee, MapPin, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface ClockEntry {
  id: string;
  clock_in: string;
  clock_out: string | null;
  break_start: string | null;
  break_end: string | null;
  location_lat: number | null;
  location_lng: number | null;
  last_location_update: string | null;
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
  const locationIntervalRef = useRef<number | null>(null);
  const { toast } = useToast();

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

  const handleClockIn = async () => {
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
      });

      if (error) {
        toast({
          title: "Error",
          description: "Failed to clock in",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Clocked in",
        description: `${warningMessage}Clocked in at ${format(new Date(), "h:mm a")}`,
      });
      checkActiveEntry();
    } catch (error) {
      toast({
        title: "Location Required",
        description: "Please enable location services to clock in",
        variant: "destructive",
      });
    } finally {
      setIsGettingLocation(false);
    }
  };

  const handleClockOut = async () => {
    if (!activeEntry) return;

    const { error } = await supabase
      .from("clock_entries")
      .update({ clock_out: new Date().toISOString() })
      .eq("id", activeEntry.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to clock out",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Clocked out",
      description: `See you tomorrow! Clocked out at ${format(new Date(), "h:mm a")}`,
    });
    setActiveEntry(null);
    setIsOnBreak(false);
  };

  const handleBreak = async () => {
    if (!activeEntry) return;

    if (isOnBreak) {
      const { error } = await supabase
        .from("clock_entries")
        .update({ break_end: new Date().toISOString() })
        .eq("id", activeEntry.id);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to end break",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Break ended",
        description: "Back to work!",
      });
      setIsOnBreak(false);
    } else {
      const { error } = await supabase
        .from("clock_entries")
        .update({ break_start: new Date().toISOString() })
        .eq("id", activeEntry.id);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to start break",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Break started",
        description: "Enjoy your break!",
      });
      setIsOnBreak(true);
    }
  };

  if (!activeEntry) {
    return (
      <div className="space-y-2">
        <Button 
          onClick={handleClockIn} 
          size="lg" 
          className="w-full"
          disabled={isGettingLocation}
        >
          <Clock className="mr-2 h-5 w-5" />
          {isGettingLocation ? "Getting Location..." : "Clock In"}
        </Button>
        
        {currentLocation && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span>Location ready (±{Math.round(currentLocation.accuracy)}m)</span>
          </div>
        )}
        
        {locationError && (
          <div className="flex items-center justify-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-3 w-3" />
            <span>{locationError}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button
          onClick={handleBreak}
          variant={isOnBreak ? "default" : "outline"}
          className="flex-1"
        >
          <Coffee className="mr-2 h-4 w-4" />
          {isOnBreak ? "End Break" : "Start Break"}
        </Button>
        <Button onClick={handleClockOut} variant="destructive" className="flex-1">
          <Clock className="mr-2 h-4 w-4" />
          Clock Out
        </Button>
      </div>
      
      {currentLocation && (
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" />
          <span>
            Tracking location • Last update: {activeEntry.last_location_update 
              ? format(new Date(activeEntry.last_location_update), "h:mm a")
              : "Now"}
          </span>
        </div>
      )}
    </div>
  );
};

export default ClockButton;