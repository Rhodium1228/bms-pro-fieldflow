import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/BottomNav";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar as CalendarIcon, MapPin, ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isToday, addWeeks, subWeeks, addMonths, subMonths } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
  const [viewMode, setViewMode] = useState<"daily" | "weekly" | "monthly">("monthly");
  const navigate = useNavigate();

  useEffect(() => {
    loadJobs();
  }, [selectedDate, viewMode]);

  const loadJobs = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let start: Date;
    let end: Date;

    if (viewMode === "weekly") {
      start = startOfWeek(selectedDate);
      end = endOfWeek(selectedDate);
    } else if (viewMode === "daily") {
      start = new Date(selectedDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(selectedDate);
      end.setHours(23, 59, 59, 999);
    } else {
      start = startOfMonth(selectedDate);
      end = endOfMonth(selectedDate);
    }

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

  const weekDays = eachDayOfInterval({
    start: startOfWeek(selectedDate),
    end: endOfWeek(selectedDate),
  });

  const handlePrevious = () => {
    if (viewMode === "weekly") {
      setSelectedDate(subWeeks(selectedDate, 1));
    } else if (viewMode === "monthly") {
      setSelectedDate(subMonths(selectedDate, 1));
    }
  };

  const handleNext = () => {
    if (viewMode === "weekly") {
      setSelectedDate(addWeeks(selectedDate, 1));
    } else if (viewMode === "monthly") {
      setSelectedDate(addMonths(selectedDate, 1));
    }
  };

  const getHeaderText = () => {
    if (viewMode === "daily") {
      return format(selectedDate, "EEEE, MMMM d, yyyy");
    } else if (viewMode === "weekly") {
      const start = startOfWeek(selectedDate);
      const end = endOfWeek(selectedDate);
      return `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`;
    } else {
      return format(selectedDate, "MMMM yyyy");
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-primary text-primary-foreground p-6 rounded-b-3xl shadow-lg">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <div className="flex items-center justify-between mt-2">
          {(viewMode === "weekly" || viewMode === "monthly") && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevious}
              className="text-primary-foreground hover:bg-primary-foreground/20"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          )}
          <p className="text-primary-foreground/90 flex-1 text-center">
            {getHeaderText()}
          </p>
          {(viewMode === "weekly" || viewMode === "monthly") && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNext}
              className="text-primary-foreground hover:bg-primary-foreground/20"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as typeof viewMode)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="daily">Daily</TabsTrigger>
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
          </TabsList>

          <TabsContent value="daily" className="mt-4 space-y-3">
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
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{job.customer_name}</h3>
                          <Badge className={statusColors[job.status as keyof typeof statusColors]}>
                            {job.status.replace("_", " ")}
                          </Badge>
                        </div>
                        <div className="flex items-start gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                          <span>{job.customer_address}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CalendarIcon className="h-4 w-4 shrink-0" />
                          <span>{format(new Date(job.scheduled_start), "h:mm a")}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="weekly" className="mt-4">
            <div className="grid grid-cols-1 gap-3">
              {weekDays.map((day) => {
                const dayJobs = getJobsForDay(day);
                const isCurrentDay = isToday(day);
                
                return (
                  <Card key={day.toISOString()} className={cn(
                    isCurrentDay && "border-primary"
                  )}>
                    <CardContent className="p-4">
                      <div className="font-semibold mb-3 flex items-center justify-between">
                        <span className={cn(isCurrentDay && "text-primary")}>
                          {format(day, "EEEE, MMM d")}
                        </span>
                        {isCurrentDay && (
                          <Badge variant="outline" className="border-primary text-primary">
                            Today
                          </Badge>
                        )}
                      </div>
                      {dayJobs.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No jobs</p>
                      ) : (
                        <div className="space-y-2">
                          {dayJobs.map((job) => (
                            <div
                              key={job.id}
                              className="flex items-start justify-between gap-2 p-2 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                              onClick={() => navigate(`/tasks/${job.id}`)}
                            >
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">{job.customer_name}</span>
                                  <Badge 
                                    variant="outline" 
                                    className={cn("text-xs", statusColors[job.status as keyof typeof statusColors])}
                                  >
                                    {job.status.replace("_", " ")}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(job.scheduled_start), "h:mm a")}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="monthly" className="mt-4 space-y-4">
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
      </TabsContent>
    </Tabs>
      </div>

      <BottomNav />
    </div>
  );
};

export default Calendar;