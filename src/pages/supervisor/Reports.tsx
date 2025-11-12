import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import SupervisorBottomNav from "@/components/supervisor/SupervisorBottomNav";
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from "recharts";
import { 
  Loader2, TrendingUp, Clock, CheckCircle, Users, 
  Award, Calendar, Target 
} from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, eachDayOfInterval } from "date-fns";

interface TechnicianStats {
  user_id: string;
  full_name: string;
  jobs_completed: number;
  total_hours: number;
  avg_completion_time: number;
  tasks_completed: number;
  tasks_total: number;
  completion_rate: number;
}

interface DailyStats {
  date: string;
  jobs_completed: number;
  hours_worked: number;
}

type DateRange = "daily" | "weekly" | "monthly";

const Reports = () => {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>("weekly");
  const [technicianStats, setTechnicianStats] = useState<TechnicianStats[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [totalMetrics, setTotalMetrics] = useState({
    totalJobsCompleted: 0,
    avgCompletionTime: 0,
    totalHoursWorked: 0,
    teamEfficiency: 0,
  });

  const getDateRangeFilter = () => {
    const now = new Date();
    switch (dateRange) {
      case "daily":
        return { start: subDays(now, 7), end: now };
      case "weekly":
        return { start: startOfWeek(now), end: endOfWeek(now) };
      case "monthly":
        return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  };

  const loadReportsData = async () => {
    try {
      setLoading(true);
      const { start, end } = getDateRangeFilter();

      const { data: staffRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "staff");

      if (!staffRoles || staffRoles.length === 0) {
        setLoading(false);
        return;
      }

      const staffIds = staffRoles.map(r => r.user_id);

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", staffIds);

      const { data: completedJobs } = await supabase
        .from("jobs")
        .select("*")
        .eq("status", "completed")
        .gte("completed_at", start.toISOString())
        .lte("completed_at", end.toISOString())
        .in("assigned_to", staffIds);

      const { data: clockEntries } = await supabase
        .from("clock_entries")
        .select("*")
        .gte("clock_in", start.toISOString())
        .lte("clock_in", end.toISOString())
        .in("user_id", staffIds);

      const techStats: TechnicianStats[] = (profiles || []).map(profile => {
        const userJobs = (completedJobs || []).filter(j => j.assigned_to === profile.user_id);
        const userClockEntries = (clockEntries || []).filter(e => e.user_id === profile.user_id);

        const jobsCompleted = userJobs.length;
        
        const totalHours = userClockEntries.reduce((sum, entry) => {
          if (entry.total_hours) return sum + Number(entry.total_hours);
          if (entry.clock_out) {
            const clockIn = new Date(entry.clock_in);
            const clockOut = new Date(entry.clock_out);
            const hours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
            return sum + hours;
          }
          return sum;
        }, 0);

        const avgCompletionTime = userJobs.length > 0
          ? userJobs.reduce((sum, job) => {
              if (job.scheduled_start && job.completed_at) {
                const scheduled = new Date(job.scheduled_start);
                const completed = new Date(job.completed_at);
                const hours = (completed.getTime() - scheduled.getTime()) / (1000 * 60 * 60);
                return sum + hours;
              }
              return sum;
            }, 0) / userJobs.length
          : 0;

        const tasksData = userJobs.reduce((acc, job) => {
          if (job.materials_checklist) {
            const checklist = job.materials_checklist as any[];
            acc.total += checklist.length;
            acc.completed += checklist.filter(item => item.completed).length;
          }
          return acc;
        }, { completed: 0, total: 0 });

        const completionRate = tasksData.total > 0 
          ? (tasksData.completed / tasksData.total) * 100 
          : 0;

        return {
          user_id: profile.user_id,
          full_name: profile.full_name,
          jobs_completed: jobsCompleted,
          total_hours: Math.round(totalHours * 10) / 10,
          avg_completion_time: Math.round(avgCompletionTime * 10) / 10,
          tasks_completed: tasksData.completed,
          tasks_total: tasksData.total,
          completion_rate: Math.round(completionRate),
        };
      });

      techStats.sort((a, b) => b.jobs_completed - a.jobs_completed);
      setTechnicianStats(techStats);

      const days = eachDayOfInterval({ start, end });
      const dailyData: DailyStats[] = days.map(day => {
        const dayStart = new Date(day);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(day);
        dayEnd.setHours(23, 59, 59, 999);

        const dayJobs = (completedJobs || []).filter(job => {
          if (!job.completed_at) return false;
          const completedDate = new Date(job.completed_at);
          return completedDate >= dayStart && completedDate <= dayEnd;
        }).length;

        const dayHours = (clockEntries || []).reduce((sum, entry) => {
          const entryDate = new Date(entry.clock_in);
          if (entryDate >= dayStart && entryDate <= dayEnd) {
            if (entry.total_hours) return sum + Number(entry.total_hours);
            if (entry.clock_out) {
              const clockIn = new Date(entry.clock_in);
              const clockOut = new Date(entry.clock_out);
              const hours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
              return sum + hours;
            }
          }
          return sum;
        }, 0);

        return {
          date: format(day, "MMM dd"),
          jobs_completed: dayJobs,
          hours_worked: Math.round(dayHours * 10) / 10,
        };
      });

      setDailyStats(dailyData);

      const totalJobs = completedJobs?.length || 0;
      const totalHours = techStats.reduce((sum, t) => sum + t.total_hours, 0);
      const avgTime = techStats.length > 0
        ? techStats.reduce((sum, t) => sum + t.avg_completion_time, 0) / techStats.length
        : 0;
      const avgEfficiency = techStats.length > 0
        ? techStats.reduce((sum, t) => sum + t.completion_rate, 0) / techStats.length
        : 0;

      setTotalMetrics({
        totalJobsCompleted: totalJobs,
        avgCompletionTime: Math.round(avgTime * 10) / 10,
        totalHoursWorked: Math.round(totalHours * 10) / 10,
        teamEfficiency: Math.round(avgEfficiency),
      });

    } catch (error) {
      console.error("Error loading reports data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportsData();
  }, [dateRange]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--danger))', 'hsl(var(--accent))'];

  const techPerformanceData = technicianStats.slice(0, 5).map(tech => ({
    name: tech.full_name.split(' ')[0],
    jobs: tech.jobs_completed,
    hours: tech.total_hours,
  }));

  const completionRateData = [
    { name: "Completed Tasks", value: technicianStats.reduce((sum, t) => sum + t.tasks_completed, 0) },
    { name: "Pending Tasks", value: technicianStats.reduce((sum, t) => sum + (t.tasks_total - t.tasks_completed), 0) },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container mx-auto p-4 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Reports & Analytics</h1>
          <p className="text-muted-foreground">Team performance metrics and insights</p>
        </div>

        <Tabs value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="daily">
              <Calendar className="h-4 w-4 mr-2" />
              Last 7 Days
            </TabsTrigger>
            <TabsTrigger value="weekly">
              <Calendar className="h-4 w-4 mr-2" />
              This Week
            </TabsTrigger>
            <TabsTrigger value="monthly">
              <Calendar className="h-4 w-4 mr-2" />
              This Month
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                Jobs Completed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{totalMetrics.totalJobsCompleted}</div>
              <p className="text-xs text-muted-foreground mt-1">Total jobs finished</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Avg Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{totalMetrics.avgCompletionTime}h</div>
              <p className="text-xs text-muted-foreground mt-1">Per job completion</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Team Hours
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{totalMetrics.totalHoursWorked}h</div>
              <p className="text-xs text-muted-foreground mt-1">Total worked</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Efficiency
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{totalMetrics.teamEfficiency}%</div>
              <p className="text-xs text-muted-foreground mt-1">Task completion rate</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Job Completion Trend</CardTitle>
            <CardDescription>Daily jobs completed over selected period</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={dailyStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '0.5rem' }} />
                <Line type="monotone" dataKey="jobs_completed" stroke="hsl(var(--primary))" strokeWidth={2} name="Jobs Completed" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Performers</CardTitle>
            <CardDescription>Jobs completed by top 5 technicians</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={techPerformanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '0.5rem' }} />
                <Bar dataKey="jobs" fill="hsl(var(--primary))" name="Jobs Completed" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {completionRateData[0].value + completionRateData[1].value > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Task Completion Status</CardTitle>
              <CardDescription>Overall task completion across all jobs</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={completionRateData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="hsl(var(--primary))"
                    dataKey="value"
                  >
                    {completionRateData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '0.5rem' }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Technician Leaderboard
            </CardTitle>
            <CardDescription>Ranked by jobs completed and performance metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {technicianStats.map((tech, index) => (
                <div key={tech.user_id} className="flex items-center justify-between p-4 rounded-lg bg-accent/5 border border-border">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 font-bold text-primary">
                      {index + 1}
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{tech.full_name}</h3>
                      <div className="flex gap-3 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><Target className="h-3 w-3" />{tech.jobs_completed} jobs</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{tech.total_hours}h</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={tech.completion_rate >= 80 ? "default" : tech.completion_rate >= 60 ? "secondary" : "outline"}>
                      {tech.completion_rate}% Tasks
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">Avg: {tech.avg_completion_time}h/job</p>
                  </div>
                </div>
              ))}

              {technicianStats.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No data available for selected period
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <SupervisorBottomNav />
    </div>
  );
};

export default Reports;
