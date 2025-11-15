import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Navigation, WifiOff } from "lucide-react";

interface LocationUpdateIndicatorProps {
  lastUpdate: string | null;
}

export const LocationUpdateIndicator = ({ lastUpdate }: LocationUpdateIndicatorProps) => {
  const [isStale, setIsStale] = useState(false);

  useEffect(() => {
    if (!lastUpdate) {
      setIsStale(true);
      return;
    }

    const checkFreshness = () => {
      const now = new Date();
      const updateTime = new Date(lastUpdate);
      const diffMs = now.getTime() - updateTime.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      
      // Consider stale if older than 5 minutes
      setIsStale(diffMins > 5);
    };

    checkFreshness();
    const interval = setInterval(checkFreshness, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [lastUpdate]);

  if (!lastUpdate) {
    return (
      <Badge variant="outline" className="gap-1">
        <WifiOff className="h-3 w-3" />
        No GPS
      </Badge>
    );
  }

  if (isStale) {
    return (
      <Badge variant="secondary" className="gap-1">
        <WifiOff className="h-3 w-3" />
        GPS Stale
      </Badge>
    );
  }

  return (
    <Badge variant="default" className="gap-1 bg-success">
      <Navigation className="h-3 w-3" />
      Live GPS
    </Badge>
  );
};
