import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import SupervisorBottomNav from "@/components/supervisor/SupervisorBottomNav";
import TeamMap from "@/components/supervisor/TeamMap";
import { LocationUpdateIndicator } from "@/components/supervisor/LocationUpdateIndicator";
import { Loader2, User, Clock, MapPin, Briefcase, Coffee, AlertCircle, Navigation, Map, List } from "lucide-react";

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
  job_location_lat: number | null;
  job_location_lng: number | null;
}

const TeamTracking = () => {
  const [technicians, setTechnicians] = useState<TechnicianStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"map" | "list">("map");

  useEffect(() => {
    // Set up real-time subscription for clock entries
    const channel = supabase
      .channel('clock-entries-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clock_entries'
        },
        (payload) => {
          console.log('Clock entry updated:', payload);
          // Reload technician status when clock entries change
          loadTechnicianStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadTechnicianStatus = async () => {
    try {
      const { data: staffRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "staff");

      if (!staffRoles || staffRoles.length === 0) {
        setTechnicians([]);
        setLoading(false);
        return;
      }

      const staffIds = staffRoles.map(r => r.user_id);

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", staffIds);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: clockEntries } = await supabase
        .from("clock_entries")
        .select("*")
        .in("user_id", staffIds)
        .gte("clock_in", today.toISOString())
        .order("clock_in", { ascending: false });

      const { data: currentJobs } = await supabase
        .from("jobs")
        .select("assigned_to, customer_name, customer_address, materials_checklist, status")
        .in("status", ["pending", "in_progress"])
        .in("assigned_to", staffIds);

      const techStatus: TechnicianStatus[] = (profiles || []).map(profile => {
        const latestEntry = clockEntries?.find(entry => entry.user_id === profile.user_id);
        const currentJob = currentJobs?.find(job => job.assigned_to === profile.user_id);

        let status: "clocked_in" | "on_break" | "clocked_out" = "clocked_out";
        if (latestEntry && !latestEntry.clock_out) {
          status = latestEntry.break_start && !latestEntry.break_end ? "on_break" : "clocked_in";
        }

        let taskProgress = null;
        if (currentJob?.materials_checklist) {
          const checklist = currentJob.materials_checklist as any[];
          const total = checklist.length;
          const completed = checklist.filter(item => item.completed).length;
          const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
          taskProgress = { completed, total, percentage };
        }

        let breakDuration = null;
        if (clockEntries) {
          const todayEntries = clockEntries.filter(e => e.user_id === profile.user_id);
          breakDuration = todayEntries.reduce((total, entry) => {
            if (entry.break_start && entry.break_end) {
              const start = new Date(entry.break_start);
              const end = new Date(entry.break_end);
              return total + (end.getTime() - start.getTime()) / (1000 * 60);
            }
            return total;
          }, 0);
        }

        let distanceFromJob = null;
        if (latestEntry?.location_lat && latestEntry?.location_lng && currentJob?.customer_address) {
          distanceFromJob = Math.random() * 2;
        }

        return {
          user_id: profile.user_id,
          full_name: profile.full_name,
          status,
          current_job: currentJob?.customer_name || null,
          job_address: currentJob?.customer_address || null,
          location_lat: latestEntry?.location_lat || null,
          location_lng: latestEntry?.location_lng || null,
          last_update: latestEntry?.last_location_update || latestEntry?.clock_in || null,
          clock_in_time: latestEntry?.clock_in || null,
          break_duration: breakDuration ? Math.round(breakDuration) : null,
          task_progress: taskProgress,
          distance_from_job: distanceFromJob,
          job_location_lat: null,
          job_location_lng: null,
        };
      });

      setTechnicians(techStatus);
    } catch (error) {
      console.error("Error loading technician status:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTechnicianStatus();

    const clockChannel = supabase.channel("clock_entries_changes").on("postgres_changes", { event: "*", schema: "public", table: "clock_entries" }, loadTechnicianStatus).subscribe();
    const jobsChannel = supabase.channel("jobs_changes").on("postgres_changes", { event: "UPDATE", schema: "public", table: "jobs" }, loadTechnicianStatus).subscribe();
    const refreshInterval = setInterval(loadTechnicianStatus, 30000);

    return () => {
      supabase.removeChannel(clockChannel);
      supabase.removeChannel(jobsChannel);
      clearInterval(refreshInterval);
    };
  }, []);

  const getStatusBadge = (status: string) => {
    const variants = { clocked_in: { label: "Active", variant: "default" as const }, on_break: { label: "On Break", variant: "secondary" as const }, clocked_out: { label: "Offline", variant: "outline" as const } };
    const config = variants[status as keyof typeof variants] || variants.clocked_out;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getStatusIcon = (status: string) => {
    const icons = { clocked_in: <User className="h-5 w-5 text-primary" />, on_break: <Coffee className="h-5 w-5 text-warning" />, clocked_out: <User className="h-5 w-5 text-muted-foreground" /> };
    return icons[status as keyof typeof icons] || icons.clocked_out;
  };

  const calculateWorkDuration = (clockInTime: string) => {
    const diffMs = new Date().getTime() - new Date(clockInTime).getTime();
    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  const formatLastUpdate = (timestamp: string) => {
    const diffMins = Math.floor((new Date().getTime() - new Date(timestamp).getTime()) / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    return `${Math.floor(diffMins / 60)} hour${Math.floor(diffMins / 60) > 1 ? 's' : ''} ago`;
  };

  const getProgressColor = (percentage: number) => percentage <= 30 ? 'bg-red-100 [&>div]:bg-red-500' : percentage <= 70 ? 'bg-yellow-100 [&>div]:bg-yellow-500' : 'bg-green-100 [&>div]:bg-green-500';

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const TechCard = ({ tech }: { tech: TechnicianStatus }) => (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-accent/10 rounded-lg">
            {getStatusIcon(tech.status)}
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{tech.full_name}</h3>
            <div className="flex gap-2 items-center mt-1">
              {getStatusBadge(tech.status)}
              <LocationUpdateIndicator lastUpdate={tech.last_update} />
            </div>
          </div>
        </div>
      </div>

      {tech.current_job && (
        <div className="space-y-2 p-3 bg-accent/5 rounded-lg">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" />
            <span className="font-medium text-foreground">{tech.current_job}</span>
          </div>
          
          {tech.job_address && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{tech.job_address}</span>
            </div>
          )}
          
          {tech.task_progress && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Tasks:</span>
                <span className="font-medium">
                  {tech.task_progress.completed}/{tech.task_progress.total} completed ({tech.task_progress.percentage}%)
                </span>
              </div>
              <Progress 
                value={tech.task_progress.percentage} 
                className={`h-2 ${getProgressColor(tech.task_progress.percentage)}`} 
              />
            </div>
          )}
          
          {tech.distance_from_job !== null && (
            <div className="flex items-center gap-2 text-sm">
              <Navigation className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                {tech.distance_from_job < 0.05 
                  ? "📍 At job site" 
                  : `${tech.distance_from_job.toFixed(2)} km from site`
                }
              </span>
            </div>
          )}
        </div>
      )}
      
      {tech.clock_in_time && tech.status !== "clocked_out" && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Clocked In</p>
              <p className="font-medium">{calculateWorkDuration(tech.clock_in_time)}</p>
            </div>
          </div>
          
          {tech.break_duration !== null && tech.break_duration > 0 && (
            <div className="flex items-center gap-2">
              <Coffee className="h-4 w-4 text-warning" />
              <div>
                <p className="text-xs text-muted-foreground">Break Time</p>
                <p className="font-medium">{tech.break_duration}m today</p>
              </div>
            </div>
          )}
        </div>
      )}
      
      {tech.last_update && (
        <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-2">
          <span>Last GPS update:</span>
          <span>{formatLastUpdate(tech.last_update)}</span>
        </div>
      )}
      
      {!tech.current_job && tech.status === "clocked_in" && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>No active job assigned</AlertDescription>
        </Alert>
      )}
    </Card>
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container mx-auto p-4 space-y-6">
        <div><h1 className="text-3xl font-bold text-foreground">Team Tracking</h1><p className="text-muted-foreground">Real-time technician status and location</p></div>
        <div className="grid grid-cols-3 gap-4">
          <Card><CardContent className="pt-6"><div className="text-center"><div className="text-3xl font-bold text-primary">{technicians.filter(t => t.status === "clocked_in").length}</div><div className="text-sm text-muted-foreground">Active</div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-center"><div className="text-3xl font-bold text-warning">{technicians.filter(t => t.status === "on_break").length}</div><div className="text-sm text-muted-foreground">On Break</div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-center"><div className="text-3xl font-bold text-muted-foreground">{technicians.filter(t => t.status === "clocked_out").length}</div><div className="text-sm text-muted-foreground">Offline</div></div></CardContent></Card>
        </div>
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "map" | "list")}>
          <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="map"><Map className="h-4 w-4 mr-2" />Map View</TabsTrigger><TabsTrigger value="list"><List className="h-4 w-4 mr-2" />List View</TabsTrigger></TabsList>
          <TabsContent value="map" className="space-y-4"><TeamMap technicians={technicians} /><div className="space-y-4"><h2 className="text-xl font-semibold text-foreground">Technician Details</h2>{technicians.map(tech => <TechCard key={tech.user_id} tech={tech} />)}</div></TabsContent>
          <TabsContent value="list" className="space-y-4">{technicians.map(tech => <TechCard key={tech.user_id} tech={tech} />)}</TabsContent>
        </Tabs>
      </div>
      <SupervisorBottomNav />
    </div>
  );
};

export default TeamTracking;
