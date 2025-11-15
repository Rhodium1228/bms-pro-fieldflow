import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UseLocationTrackingProps {
  enabled: boolean;
  userId: string | null;
  clockEntryId: string | null;
}

export const useLocationTracking = ({
  enabled,
  userId,
  clockEntryId,
}: UseLocationTrackingProps) => {
  const { toast } = useToast();
  const watchIdRef = useRef<number | null>(null);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled || !userId || !clockEntryId) {
      // Clean up tracking when disabled
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }
      return;
    }

    // Check if geolocation is available
    if (!navigator.geolocation) {
      toast({
        title: "Location unavailable",
        description: "Your browser doesn't support location tracking",
        variant: "destructive",
      });
      return;
    }

    console.log("Starting location tracking for user:", userId);

    // Function to update location in database
    const updateLocation = async (position: GeolocationPosition) => {
      const { latitude, longitude } = position.coords;
      
      console.log("Updating location:", { latitude, longitude, clockEntryId });

      const { error } = await supabase
        .from("clock_entries")
        .update({
          location_lat: latitude,
          location_lng: longitude,
          last_location_update: new Date().toISOString(),
        })
        .eq("id", clockEntryId);

      if (error) {
        console.error("Error updating location:", error);
      }
    };

    // Start watching position
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        updateLocation(position);
      },
      (error) => {
        console.error("Geolocation error:", error);
        if (error.code === error.PERMISSION_DENIED) {
          toast({
            title: "Location permission denied",
            description: "Please enable location access to track your position",
            variant: "destructive",
          });
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 30000, // 30 seconds
        timeout: 27000, // 27 seconds
      }
    );

    // Also update location every 2 minutes as a fallback
    updateIntervalRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          updateLocation(position);
        },
        (error) => {
          console.error("Periodic location update error:", error);
        }
      );
    }, 120000); // 2 minutes

    // Cleanup on unmount
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [enabled, userId, clockEntryId, toast]);
};
