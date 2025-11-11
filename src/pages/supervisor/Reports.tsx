import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import SupervisorBottomNav from "@/components/supervisor/SupervisorBottomNav";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Briefcase, Clock, CheckCircle, TrendingUp } from "lucide-react";

interface ReportStats {
  totalJobs: number;
  completedJobs: number;
  totalHours: number;
  averageCompletionTime: number;
}

interface StaffPerformance {
  name: string;
  jobsCompleted: number;
  hoursWorked: number;
}

const Reports = () => {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("week");
  const [stats, setStats] = useState<ReportStats>({
    totalJobs: 0,
    completedJobs: 0,
    totalHours: 0,
    averageCompletionTime: 0,
  });
  const [staffPerformance, setStaffPerformance] = useState<StaffPerformance[]>([]);
  const [jobStatusData, setJobStatusData] = useState<any[]>([]);

  useEffect(() => {
    loadReportData();
  }, [period]);

  const loadReportData = async () => {
    try {
      const now = new Date();
      let startDate: Date;

      switch (period) {
        case "today":
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case "week":
          startDate = new Date(now.setDate(now.getDate() - 7));
          break;
        case "month":
          startDate = new Date(now.setMonth(now.getMonth() - 1));
          break;
        default:
          startDate = new Date(now.setDate(now.getDate() - 7));
      }

      // Get jobs data
      const { data: jobs } = await supabase
        .from("jobs")
        .select("*")
        .gte("created_at", startDate.toISOString());

      const totalJobs = jobs?.length || 0;
      const completedJobs = jobs?.filter(j => j.status === "completed").length || 0;

      // Get status distribution
      const statusCounts: { [key: string]: number } = {};
      jobs?.forEach(job => {
        statusCounts[job.status] = (statusCounts[job.status] || 0) + 1;
      });

      const statusData = Object.entries(statusCounts).map(([status, count]) => ({
        name: status.replace("_", " "),
        value: count,
      }));

      setJobStatusData(statusData);

      // Get clock entries
      const { data: clockEntries } = await supabase
        .from("clock_entries")
        .select("*")
        .gte("clock_in", startDate.toISOString());

      let totalHours = 0;
      clockEntries?.forEach(entry => {
        if (entry.clock_in && entry.clock_out) {
          const hours = (new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / (1000 * 60 * 60);
          totalHours += hours;
        }
      });

      // Get staff performance
      const { data: staffRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "staff");

      const staffIds = staffRoles?.map(r => r.user_id) || [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", staffIds);

      const performance: StaffPerformance[] = [];

      for (const profile of profiles || []) {
        const staffJobs = jobs?.filter(j => j.assigned_to === profile.user_id) || [];
        const staffCompleted = staffJobs.filter(j => j.status === "completed").length;
        
        const staffClock = clockEntries?.filter(e => e.user_id === profile.user_id) || [];
        let staffHours = 0;
        staffClock.forEach(entry => {
          if (entry.clock_in && entry.clock_out) {
            const hours = (new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / (1000 * 60 * 60);
            staffHours += hours;
          }
        });

        performance.push({
          name: profile.full_name,
          jobsCompleted: staffCompleted,
          hoursWorked: parseFloat(staffHours.toFixed(1)),
        });
      }

      performance.sort((a, b) => b.jobsCompleted - a.jobsCompleted);

      setStaffPerformance(performance.slice(0, 5));
      setStats({
        totalJobs,
        completedJobs,
        totalHours: parseFloat(totalHours.toFixed(1)),
        averageCompletionTime: completedJobs > 0 ? parseFloat((totalHours / completedJobs).toFixed(1)) : 0,
      });
    } catch (error) {
      console.error("Error loading report data:", error);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ["hsl(var(--primary))", "hsl(var(--warning))", "hsl(var(--success))", "hsl(var(--muted))"];

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
            <h1 className="text-2xl font-bold text-foreground">Reports & Analytics</h1>
            <p className="text-sm text-muted-foreground">Team performance metrics</p>
          </div>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Briefcase className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.totalJobs}</p>
                <p className="text-xs text-muted-foreground">Total Jobs</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-success/10 rounded-lg">
                <CheckCircle className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.completedJobs}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-warning/10 rounded-lg">
                <Clock className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.totalHours}</p>
                <p className="text-xs text-muted-foreground">Total Hours</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.averageCompletionTime}</p>
                <p className="text-xs text-muted-foreground">Avg Hours/Job</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Job Status Distribution */}
        {jobStatusData.length > 0 && (
          <Card className="p-4">
            <h3 className="font-semibold mb-4 text-foreground">Job Status Distribution</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={jobStatusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {jobStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Top Performing Staff */}
        {staffPerformance.length > 0 && (
          <Card className="p-4">
            <h3 className="font-semibold mb-4 text-foreground">Top Performers - Jobs Completed</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={staffPerformance}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--foreground))" />
                <YAxis stroke="hsl(var(--foreground))" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--background))", 
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px"
                  }} 
                />
                <Bar dataKey="jobsCompleted" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Hours Worked */}
        {staffPerformance.length > 0 && (
          <Card className="p-4">
            <h3 className="font-semibold mb-4 text-foreground">Hours Worked by Staff</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={staffPerformance}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--foreground))" />
                <YAxis stroke="hsl(var(--foreground))" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--background))", 
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px"
                  }} 
                />
                <Bar dataKey="hoursWorked" fill="hsl(var(--warning))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>

      <SupervisorBottomNav />
    </div>
  );
};

export default Reports;
