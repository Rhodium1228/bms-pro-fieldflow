import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/BottomNav";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, MapPin } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from "date-fns";
import { cn } from "@/lib/utils";

interface Job {
  id: string;
  customer_name: string;
  customer_address: string;
  scheduled_start: string;
  status: string;
}

const statusColors = {
  pending: "bg-muted",
  in_progress: "bg-primary",
  completed: "bg-success",
  cancelled: "bg-destructive",
};

const Calendar = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const navigate = useNavigate();

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const start = startOfMonth(selectedDate);
    const end = endOfMonth(selectedDate);

    const { data } = await supabase
      .from("jobs")
      .select("*")
      .eq("assigned_to", user.id)
      .gte("scheduled_start", start.toISOString())
      .lte("scheduled_start", end.toISOString())
      .order("scheduled_start", { ascending: true });

    if (data) {
      setJobs(data);
    }
  };

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(selectedDate),
    end: endOfMonth(selectedDate),
  });

  const getJobsForDay = (day: Date) => {
    return jobs.filter((job) =>
      isSameDay(new Date(job.scheduled_start), day)
    );
  };

  const selectedDayJobs = getJobsForDay(selectedDate);

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-primary text-primary-foreground p-6 rounded-b-3xl shadow-lg">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <p className="text-primary-foreground/90">
          {format(selectedDate, "MMMM yyyy")}
        </p>
      </div>

      <div className="p-4 space-y-4">
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-7 gap-2 mb-4">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div
                  key={day}
                  className="text-center text-xs font-medium text-muted-foreground"
                >
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {daysInMonth.map((day, idx) => {
                const dayJobs = getJobsForDay(day);
                const hasJobs = dayJobs.length > 0;
                const isSelected = isSameDay(day, selectedDate);
                const isCurrentDay = isToday(day);

                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedDate(day)}
                    className={cn(
                      "aspect-square p-1 rounded-lg text-sm font-medium transition-colors relative",
                      isSelected && "bg-primary text-primary-foreground",
                      !isSelected && isCurrentDay && "bg-accent text-accent-foreground",
                      !isSelected && !isCurrentDay && "hover:bg-muted"
                    )}
                  >
                    {format(day, "d")}
                    {hasJobs && (
                      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                        {dayJobs.slice(0, 3).map((job, i) => (
                          <div
                            key={i}
                            className={cn(
                              "w-1 h-1 rounded-full",
                              isSelected
                                ? "bg-primary-foreground"
                                : statusColors[job.status as keyof typeof statusColors]
                            )}
                          />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <CalendarIcon className="h-5 w-5 text-muted-foreground" />
            <h2 className="font-semibold">
              {format(selectedDate, "MMMM d, yyyy")}
            </h2>
          </div>
          <div className="space-y-2">
            {selectedDayJobs.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                  No jobs scheduled for this day
                </CardContent>
              </Card>
            ) : (
              selectedDayJobs.map((job) => (
                <Card
                  key={job.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate(`/tasks/${job.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold">{job.customer_name}</h3>
                      <Badge
                        className={cn(
                          "shrink-0",
                          statusColors[job.status as keyof typeof statusColors],
                          "text-white"
                        )}
                      >
                        {job.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <MapPin className="mr-2 h-4 w-4 shrink-0" />
                      <span className="truncate">{job.customer_address}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      {format(new Date(job.scheduled_start), "h:mm a")}
                    </p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default Calendar;