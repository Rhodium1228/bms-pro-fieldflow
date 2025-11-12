import { GoogleMap, LoadScript, Marker, InfoWindow } from '@react-google-maps/api';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { MapPin, Clock, Navigation } from 'lucide-react';

interface TechnicianStatus {
  user_id: string;
  full_name: string;
  status: "clocked_in" | "on_break" | "clocked_out";
  current_job: string | null;
  job_address: string | null;
  location_lat: number | null;
  location_lng: number | null;
  last_update: string | null;
  clock_in_time: string | null;
  break_duration: number | null;
  task_progress: {
    completed: number;
    total: number;
    percentage: number;
  } | null;
  distance_from_job: number | null;
}

interface TeamMapProps {
  technicians: TechnicianStatus[];
}

const mapContainerStyle = {
  width: '100%',
  height: '500px',
  borderRadius: '0.5rem'
};

const defaultCenter = {
  lat: 41.8781,
  lng: -87.6298
};

// Create color-coded marker icons
const createMarkerIcon = (color: string) => {
  return {
    path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
    fillColor: color,
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2,
    scale: 1.5,
  };
};

const markerIcons = {
  clocked_in: createMarkerIcon('#10b981'), // Green
  on_break: createMarkerIcon('#f59e0b'),   // Yellow
  clocked_out: createMarkerIcon('#64748b'), // Gray
};

const TeamMap = ({ technicians }: TeamMapProps) => {
  const [selectedTech, setSelectedTech] = useState<TechnicianStatus | null>(null);

  // Filter technicians with valid GPS coordinates
  const techsWithLocation = technicians.filter(
    tech => tech.location_lat !== null && tech.location_lng !== null
  );

  // Calculate map center and bounds
  const getMapCenter = () => {
    if (techsWithLocation.length === 0) return defaultCenter;
    
    const avgLat = techsWithLocation.reduce((sum, tech) => sum + (tech.location_lat || 0), 0) / techsWithLocation.length;
    const avgLng = techsWithLocation.reduce((sum, tech) => sum + (tech.location_lng || 0), 0) / techsWithLocation.length;
    
    return { lat: avgLat, lng: avgLng };
  };

  const formatLastUpdate = (timestamp: string) => {
    const now = new Date();
    const updateTime = new Date(timestamp);
    const diffMs = now.getTime() - updateTime.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      clocked_in: { label: "Active", variant: "default" as const },
      on_break: { label: "On Break", variant: "secondary" as const },
      clocked_out: { label: "Offline", variant: "outline" as const },
    };
    
    const config = variants[status as keyof typeof variants] || variants.clocked_out;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (techsWithLocation.length === 0) {
    return (
      <div className="w-full h-[500px] rounded-lg border bg-muted/10 flex items-center justify-center">
        <div className="text-center space-y-2">
          <MapPin className="h-12 w-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">No technicians with GPS data available</p>
        </div>
      </div>
    );
  }

  return (
    <LoadScript googleMapsApiKey="AIzaSyADacnWnRxm_tmN-3uuWCTEn76-sn36UdI">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={getMapCenter()}
        zoom={11}
        options={{
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
        }}
      >
        {techsWithLocation.map((tech) => (
          <Marker
            key={tech.user_id}
            position={{
              lat: tech.location_lat!,
              lng: tech.location_lng!
            }}
            icon={markerIcons[tech.status]}
            onClick={() => setSelectedTech(tech)}
          />
        ))}

        {selectedTech && (
          <InfoWindow
            position={{
              lat: selectedTech.location_lat!,
              lng: selectedTech.location_lng!
            }}
            onCloseClick={() => setSelectedTech(null)}
          >
            <div className="p-2 min-w-[250px] space-y-3">
              <div className="space-y-1">
                <h3 className="font-semibold text-foreground">{selectedTech.full_name}</h3>
                {getStatusBadge(selectedTech.status)}
              </div>

              {selectedTech.current_job && (
                <div className="space-y-2 border-t pt-2">
                  <div className="font-medium text-sm text-foreground">
                    {selectedTech.current_job}
                  </div>
                  
                  {selectedTech.job_address && (
                    <div className="flex items-start gap-2 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <span>{selectedTech.job_address}</span>
                    </div>
                  )}

                  {selectedTech.task_progress && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Tasks:</span>
                        <span className="font-medium">
                          {selectedTech.task_progress.completed}/{selectedTech.task_progress.total} ({selectedTech.task_progress.percentage}%)
                        </span>
                      </div>
                      <Progress 
                        value={selectedTech.task_progress.percentage}
                        className="h-1.5"
                      />
                    </div>
                  )}

                  {selectedTech.distance_from_job !== null && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Navigation className="h-3 w-3" />
                      <span>
                        {selectedTech.distance_from_job < 0.05 
                          ? "📍 At job site" 
                          : `${selectedTech.distance_from_job.toFixed(2)} km from site`}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {selectedTech.last_update && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground border-t pt-2">
                  <Clock className="h-3 w-3" />
                  <span>Updated {formatLastUpdate(selectedTech.last_update)}</span>
                </div>
              )}
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </LoadScript>
  );
};

export default TeamMap;
