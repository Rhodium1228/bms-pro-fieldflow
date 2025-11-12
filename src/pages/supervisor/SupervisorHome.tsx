import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SupervisorBottomNav from "@/components/supervisor/SupervisorBottomNav";
import TeamMap from "@/components/supervisor/TeamMap";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, UserCheck, Coffee, Briefcase, Plus, Clock, MapPin } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import JobForm from "@/components/supervisor/JobForm";

interface TeamStats {
  totalStaff: number;
  clockedIn: number;
  onBreak: number;
  available: number;
}

interface Job {
  id: string;
  customer_name: string;
  job_description: string;
  scheduled_start: string;
  status: string;
  priority: string;
  assigned_to: string | null;
  profiles?: {
    full_name: string;
  };
}

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

const SupervisorHome = () => {
  const navigate = useNavigate();
  const [teamStats, setTeamStats] = useState<TeamStats>({
    totalStaff: 0,
    clockedIn: 0,
    onBreak: 0,
    available: 0,
  });
  const [todayJobs, setTodayJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [technicians, setTechnicians] = useState<TechnicianStatus[]>([]);
  const [showJobDialog, setShowJobDialog] = useState(false);

  useEffect(() => {
    loadDashboardData();
    loadTeamTracking();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Get all staff members
      const { data: staffData } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "staff");

      const staffCount = staffData?.length || 0;

      // Get clock status for all staff
      const today = new Date().toISOString().split("T")[0];
      const { data: clockData } = await supabase
        .from("clock_entries")
        .select("*")
        .gte("clock_in", `${today}T00:00:00`)
        .is("clock_out", null);

      const clockedInCount = clockData?.filter(entry => !entry.break_start || entry.break_end)?.length || 0;
      const onBreakCount = clockData?.filter(entry => entry.break_start && !entry.break_end)?.length || 0;

      setTeamStats({
        totalStaff: staffCount,
        clockedIn: clockedInCount,
        onBreak: onBreakCount,
        available: clockedInCount - onBreakCount,
      });

      // Get today's jobs
      const { data: jobsData } = await supabase
        .from("jobs")
        .select("*")
        .gte("scheduled_start", `${today}T00:00:00`)
        .lt("scheduled_start", `${today}T23:59:59`)
        .order("scheduled_start", { ascending: true })
        .limit(10);

      // Fetch profiles separately
      const jobsWithProfiles = await Promise.all(
        (jobsData || []).map(async (job) => {
          if (job.assigned_to) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("user_id", job.assigned_to)
              .single();
            
            return { ...job, profiles: profile };
          }
          return { ...job, profiles: null };
        })
      );

      setTodayJobs(jobsWithProfiles);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadTeamTracking = async () => {
    try {
      const { data: staffRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "staff");

      const userIds = staffRoles?.map(r => r.user_id) || [];
      if (userIds.length === 0) return;

      const today = new Date().toISOString().split("T")[0];
      const { data: clockEntries } = await supabase
        .from("clock_entries")
        .select("*")
        .in("user_id", userIds)
        .gte("clock_in", `${today}T00:00:00`)
        .is("clock_out", null);

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

      const techStatuses: TechnicianStatus[] = await Promise.all(
        (profiles || []).map(async (profile) => {
          const clockEntry = clockEntries?.find(c => c.user_id === profile.user_id);
          
          let jobInfo = null;
          let taskProgress = null;
          
          if (clockEntry) {
            const { data: job } = await supabase
              .from("jobs")
              .select("customer_name, customer_address, materials_checklist")
              .eq("assigned_to", profile.user_id)
              .eq("status", "in_progress")
              .single();
            
            if (job) {
              jobInfo = {
                name: job.customer_name,
                address: job.customer_address
              };
              
              const checklist = Array.isArray(job.materials_checklist) ? job.materials_checklist : [];
              const completed = checklist.filter((item: any) => item.completed).length;
              const total = checklist.length;
              taskProgress = {
                completed,
                total,
                percentage: total > 0 ? Math.round((completed / total) * 100) : 0
              };
            }
          }

          return {
            user_id: profile.user_id,
            full_name: profile.full_name,
            status: clockEntry
              ? (clockEntry.break_start && !clockEntry.break_end ? "on_break" : "clocked_in")
              : "clocked_out",
            current_job: jobInfo?.name || null,
            job_address: jobInfo?.address || null,
            location_lat: clockEntry?.location_lat || null,
            location_lng: clockEntry?.location_lng || null,
            last_update: clockEntry?.last_location_update || null,
            clock_in_time: clockEntry?.clock_in || null,
            break_duration: clockEntry?.break_duration || null,
            task_progress: taskProgress,
            distance_from_job: null
          };
        })
      );

      setTechnicians(techStatuses);
    } catch (error) {
      console.error("Error loading team tracking:", error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-success/10 text-success";
      case "in_progress":
        return "bg-primary/10 text-primary";
      case "pending":
        return "bg-warning/10 text-warning";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "text-destructive";
      case "high":
        return "text-warning";
      default:
        return "text-muted-foreground";
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
      <div className="max-w-lg mx-auto p-4 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Supervisor Dashboard</h1>
            <p className="text-sm text-muted-foreground">Team Overview</p>
          </div>
          <Dialog open={showJobDialog} onOpenChange={setShowJobDialog}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Create Job
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Job</DialogTitle>
              </DialogHeader>
              <JobForm
                onSuccess={() => {
                  setShowJobDialog(false);
                  loadDashboardData();
                }}
                onCancel={() => setShowJobDialog(false)}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* Team Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{teamStats.totalStaff}</p>
                <p className="text-xs text-muted-foreground">Total Staff</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-success/10 rounded-lg">
                <UserCheck className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{teamStats.clockedIn}</p>
                <p className="text-xs text-muted-foreground">Clocked In</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-warning/10 rounded-lg">
                <Coffee className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{teamStats.onBreak}</p>
                <p className="text-xs text-muted-foreground">On Break</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent/10 rounded-lg">
                <Briefcase className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{teamStats.available}</p>
                <p className="text-xs text-muted-foreground">Available</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Live Team Map */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Live Team Tracking
            </h2>
            <Button variant="ghost" size="sm" onClick={() => navigate("/supervisor/tracking")}>
              Full Screen
            </Button>
          </div>
          <div className="rounded-lg overflow-hidden border">
            <TeamMap technicians={technicians} />
          </div>
        </div>

        {/* Today's Jobs */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-foreground">Today's Jobs</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate("/supervisor/jobs")}>
              View All
            </Button>
          </div>

          <div className="space-y-3">
            {todayJobs.length === 0 ? (
              <Card className="p-6 text-center">
                <p className="text-muted-foreground">No jobs scheduled for today</p>
              </Card>
            ) : (
              todayJobs.map((job) => (
                <Card
                  key={job.id}
                  className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => navigate(`/tasks/${job.id}`)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">{job.customer_name}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {job.job_description}
                      </p>
                    </div>
                    <span className={`text-xs font-medium ${getPriorityColor(job.priority)}`}>
                      {job.priority?.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {job.profiles?.full_name || "Unassigned"}
                    </span>
                    <span className={`px-2 py-1 rounded-full ${getStatusColor(job.status)}`}>
                      {job.status?.replace("_", " ")}
                    </span>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Button variant="outline" onClick={() => navigate("/supervisor/timesheets")}>
            <Clock className="h-4 w-4 mr-2" />
            Timesheets
          </Button>
          <Button variant="outline" onClick={() => navigate("/supervisor/tracking")}>
            <Users className="h-4 w-4 mr-2" />
            Team Tracking
          </Button>
        </div>
      </div>
      <SupervisorBottomNav />
    </div>
  );
};

export default SupervisorHome;
