import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import SupervisorBottomNav from "@/components/supervisor/SupervisorBottomNav";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, Briefcase, Coffee } from "lucide-react";

interface TechnicianStatus {
  user_id: string;
  full_name: string;
  status: "clocked_in" | "on_break" | "clocked_out";
  current_job: string | null;
  location_lat: number | null;
  location_lng: number | null;
  last_update: string | null;
}

const TeamTracking = () => {
  const [technicians, setTechnicians] = useState<TechnicianStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTechnicianStatus();
    
    // Set up real-time subscription
    const channel = supabase
      .channel("clock_entries_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "clock_entries",
        },
        () => {
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
      // Get all staff
      const { data: staffRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "staff");

      const staffIds = staffRoles?.map(r => r.user_id) || [];

      // Get profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", staffIds);

      const today = new Date().toISOString().split("T")[0];

      // Get today's clock entries
      const { data: clockEntries } = await supabase
        .from("clock_entries")
        .select("*")
        .gte("clock_in", `${today}T00:00:00`)
        .in("user_id", staffIds)
        .order("clock_in", { ascending: false });

      // Get current jobs
      const { data: currentJobs } = await supabase
        .from("jobs")
        .select("assigned_to, customer_name")
        .eq("status", "in_progress")
        .in("assigned_to", staffIds);

      const techStatus: TechnicianStatus[] = [];

      profiles?.forEach((profile) => {
        const latestEntry = clockEntries?.find(e => e.user_id === profile.user_id);
        const currentJob = currentJobs?.find(j => j.assigned_to === profile.user_id);

        let status: "clocked_in" | "on_break" | "clocked_out" = "clocked_out";
        
        if (latestEntry && !latestEntry.clock_out) {
          if (latestEntry.break_start && !latestEntry.break_end) {
            status = "on_break";
          } else {
            status = "clocked_in";
          }
        }

        techStatus.push({
          user_id: profile.user_id,
          full_name: profile.full_name,
          status,
          current_job: currentJob?.customer_name || null,
          location_lat: latestEntry?.location_lat || null,
          location_lng: latestEntry?.location_lng || null,
          last_update: latestEntry?.last_location_update || null,
        });
      });

      setTechnicians(techStatus);
    } catch (error) {
      console.error("Error loading technician status:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "clocked_in":
        return <Badge className="bg-success text-white">Active</Badge>;
      case "on_break":
        return <Badge className="bg-warning text-white">On Break</Badge>;
      default:
        return <Badge variant="outline">Offline</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "clocked_in":
        return <Clock className="h-5 w-5 text-success" />;
      case "on_break":
        return <Coffee className="h-5 w-5 text-warning" />;
      default:
        return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-lg mx-auto p-4 space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Team Tracking</h1>
          <p className="text-sm text-muted-foreground">Real-time technician status</p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3 text-center">
            <p className="text-2xl font-bold text-success">
              {technicians.filter(t => t.status === "clocked_in").length}
            </p>
            <p className="text-xs text-muted-foreground">Active</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-2xl font-bold text-warning">
              {technicians.filter(t => t.status === "on_break").length}
            </p>
            <p className="text-xs text-muted-foreground">On Break</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-2xl font-bold text-muted-foreground">
              {technicians.filter(t => t.status === "clocked_out").length}
            </p>
            <p className="text-xs text-muted-foreground">Offline</p>
          </Card>
        </div>

        {/* Technician List */}
        <div className="space-y-3">
          {technicians.map((tech) => (
            <Card key={tech.user_id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-accent/10 rounded-lg">
                    {getStatusIcon(tech.status)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{tech.full_name}</h3>
                    {getStatusBadge(tech.status)}
                  </div>
                </div>
              </div>

              {tech.current_job && (
                <div className="flex items-center gap-2 text-sm mb-2">
                  <Briefcase className="h-4 w-4 text-primary" />
                  <span className="text-muted-foreground">Current job:</span>
                  <span className="font-medium text-foreground">{tech.current_job}</span>
                </div>
              )}

              {tech.location_lat && tech.location_lng && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    Location: {tech.location_lat.toFixed(4)}, {tech.location_lng.toFixed(4)}
                  </span>
                </div>
              )}

              {tech.last_update && (
                <p className="text-xs text-muted-foreground mt-2">
                  Last updated: {new Date(tech.last_update).toLocaleString()}
                </p>
              )}

              {!tech.current_job && tech.status === "clocked_in" && (
                <p className="text-sm text-muted-foreground italic">No active job assigned</p>
              )}
            </Card>
          ))}

          {technicians.length === 0 && (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No technicians found</p>
            </Card>
          )}
        </div>
      </div>

      <SupervisorBottomNav />
    </div>
  );
};

export default TeamTracking;
