import { useEffect, useState } from "react";
import { Calendar, dateFnsLocalizer, View } from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "@/styles/calendar.css";
import { supabase } from "@/integrations/supabase/client";
import SupervisorBottomNav from "@/components/supervisor/SupervisorBottomNav";
import { ReassignJobDialog } from "@/components/supervisor/ReassignJobDialog";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarIcon, Filter, Loader2, Users } from "lucide-react";

const locales = {
  "en-US": enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const DragAndDropCalendar = withDragAndDrop(Calendar);

interface Job {
  id: string;
  customer_name: string;
  customer_address: string;
  job_description: string;
  scheduled_start: string;
  scheduled_end: string | null;
  status: string;
  priority: string;
  assigned_to: string | null;
  profiles?: {
    full_name: string;
  };
}

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: Job;
}

interface Staff {
  user_id: string;
  full_name: string;
}

const JobScheduler = () => {
  const { toast } = useToast();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showReassignDialog, setShowReassignDialog] = useState(false);
  const [filterStaff, setFilterStaff] = useState<string>("all");
  const [view, setView] = useState<View>("week");
  const [date, setDate] = useState(new Date());

  useEffect(() => {
    loadData();
  }, [filterStaff]);

  useEffect(() => {
    // Set up real-time subscription
    const channel = supabase
      .channel("scheduler-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "jobs",
        },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filterStaff]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load staff
      const { data: staffRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "staff");

      if (staffRoles) {
        const staffIds = staffRoles.map((r) => r.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", staffIds)
          .order("full_name");

        setStaff(profiles || []);
      }

      // Load jobs
      let query = supabase
        .from("jobs")
        .select("*")
        .neq("status", "completed")
        .order("scheduled_start", { ascending: true });

      if (filterStaff !== "all") {
        query = query.eq("assigned_to", filterStaff);
      }

      const { data: jobsData, error } = await query;

      if (error) throw error;

      // Fetch profiles for jobs
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

      setJobs(jobsWithProfiles);

      // Convert to calendar events
      const calendarEvents: CalendarEvent[] = jobsWithProfiles.map((job) => {
        const start = new Date(job.scheduled_start);
        const end = job.scheduled_end
          ? new Date(job.scheduled_end)
          : new Date(start.getTime() + 2 * 60 * 60 * 1000); // Default 2 hours

        return {
          id: job.id,
          title: `${job.customer_name}${job.profiles ? ` - ${job.profiles.full_name}` : " - Unassigned"}`,
          start,
          end,
          resource: job,
        };
      });

      setEvents(calendarEvents);
    } catch (error) {
      console.error("Error loading scheduler data:", error);
      toast({
        title: "Error",
        description: "Failed to load calendar data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEventDrop = async ({
    event,
    start,
    end,
  }: {
    event: CalendarEvent;
    start: Date;
    end: Date;
  }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Update job schedule
      const { error } = await supabase
        .from("jobs")
        .update({
          scheduled_start: start.toISOString(),
          scheduled_end: end.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", event.id);

      if (error) throw error;

      // Notify assigned staff member if there is one
      if (event.resource.assigned_to) {
        await supabase.from("notifications").insert({
          user_id: event.resource.assigned_to,
          title: "Job Rescheduled",
          message: `Job "${event.resource.customer_name}" has been rescheduled to ${format(
            start,
            "PPp"
          )}`,
          type: "job_reassigned",
          related_job_id: event.id,
          created_by: user.id,
        });
      }

      toast({
        title: "Success",
        description: "Job rescheduled successfully",
      });

      loadData();
    } catch (error) {
      console.error("Error rescheduling job:", error);
      toast({
        title: "Error",
        description: "Failed to reschedule job",
        variant: "destructive",
      });
    }
  };

  const handleEventResize = async ({
    event,
    start,
    end,
  }: {
    event: CalendarEvent;
    start: Date;
    end: Date;
  }) => {
    try {
      const { error } = await supabase
        .from("jobs")
        .update({
          scheduled_start: start.toISOString(),
          scheduled_end: end.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", event.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Job duration updated",
      });

      loadData();
    } catch (error) {
      console.error("Error resizing event:", error);
      toast({
        title: "Error",
        description: "Failed to update job duration",
        variant: "destructive",
      });
    }
  };

  const handleSelectEvent = (event: CalendarEvent) => {
    setSelectedJob(event.resource);
    setShowReassignDialog(true);
  };

  const eventStyleGetter = (event: CalendarEvent) => {
    const job = event.resource;
    let backgroundColor = "#3b82f6"; // Default blue

    if (job.priority === "urgent") {
      backgroundColor = "#ef4444"; // Red
    } else if (job.priority === "high") {
      backgroundColor = "#f59e0b"; // Orange
    } else if (job.priority === "medium") {
      backgroundColor = "#10b981"; // Green
    } else {
      backgroundColor = "#6b7280"; // Gray
    }

    if (!job.assigned_to) {
      backgroundColor = "#94a3b8"; // Gray for unassigned
    }

    return {
      style: {
        backgroundColor,
        borderRadius: "4px",
        opacity: 0.9,
        color: "white",
        border: "none",
        display: "block",
      },
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-6xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Job Scheduler</h1>
            <p className="text-sm text-muted-foreground">
              Drag and drop to reschedule jobs
            </p>
          </div>
          <CalendarIcon className="h-8 w-8 text-primary" />
        </div>

        {/* Filters and Legend */}
        <Card className="p-4 space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={filterStaff} onValueChange={setFilterStaff}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by staff" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Staff</SelectItem>
                  {staff.map((member) => (
                    <SelectItem key={member.user_id} value={member.user_id}>
                      {member.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm text-muted-foreground">Priority:</span>
              <Badge className="bg-red-500">Urgent</Badge>
              <Badge className="bg-orange-500">High</Badge>
              <Badge className="bg-green-500">Medium</Badge>
              <Badge className="bg-gray-500">Low</Badge>
              <Badge className="bg-gray-400">Unassigned</Badge>
            </div>
          </div>
        </Card>

        {/* Calendar */}
        <Card className="p-4">
          <div style={{ height: "calc(100vh - 350px)", minHeight: "500px" }}>
            <DragAndDropCalendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              view={view}
              onView={(newView) => setView(newView)}
              date={date}
              onNavigate={(newDate) => setDate(newDate)}
              onEventDrop={handleEventDrop}
              onEventResize={handleEventResize}
              onSelectEvent={handleSelectEvent}
              eventPropGetter={eventStyleGetter}
              resizable
              draggableAccessor={() => true}
              popup
              selectable
              style={{ height: "100%" }}
              views={["month", "week", "day"]}
              step={30}
              showMultiDayTimes
            />
          </div>
        </Card>

        {/* Instructions */}
        <Card className="p-4 bg-accent/5">
          <div className="flex items-start gap-3">
            <Users className="h-5 w-5 text-primary mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-semibold text-sm">How to use:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Drag events to reschedule jobs</li>
                <li>• Resize events to change job duration</li>
                <li>• Click an event to reassign to different staff</li>
                <li>• Staff members receive notifications automatically</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>

      <ReassignJobDialog
        job={selectedJob}
        open={showReassignDialog}
        onOpenChange={setShowReassignDialog}
        onSuccess={loadData}
      />

      <SupervisorBottomNav />
    </div>
  );
};

export default JobScheduler;
