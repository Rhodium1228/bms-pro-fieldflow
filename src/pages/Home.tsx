import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/BottomNav";
import ClockButton from "@/components/ClockButton";
import JobCard from "@/components/JobCard";
import { Card, CardContent } from "@/components/ui/card";
import { Briefcase, CheckCircle2, Clock } from "lucide-react";

interface Job {
  id: string;
  customer_name: string;
  customer_address: string;
  job_description: string;
  scheduled_start: string;
  status: string;
  priority: string;
}

interface Profile {
  full_name: string;
}

const Home = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState({ total: 0, completed: 0, hoursWorked: 0 });
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profileData } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .single();

    if (profileData) {
      setProfile(profileData);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: jobsData } = await supabase
      .from("jobs")
      .select("*")
      .eq("assigned_to", user.id)
      .gte("scheduled_start", today.toISOString())
      .order("scheduled_start", { ascending: true })
      .limit(5);

    if (jobsData) {
      setJobs(jobsData);
      const completed = jobsData.filter((j) => j.status === "completed").length;
      setStats((prev) => ({ ...prev, total: jobsData.length, completed }));
    }

    const { data: clockData } = await supabase
      .from("clock_entries")
      .select("clock_in, clock_out")
      .eq("user_id", user.id)
      .gte("clock_in", today.toISOString())
      .not("clock_out", "is", null);

    if (clockData) {
      const hours = clockData.reduce((acc, entry) => {
        const start = new Date(entry.clock_in);
        const end = new Date(entry.clock_out);
        return acc + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      }, 0);
      setStats((prev) => ({ ...prev, hoursWorked: Math.round(hours * 10) / 10 }));
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-primary text-primary-foreground p-6 rounded-b-3xl shadow-lg">
        <h1 className="text-2xl font-bold mb-1">Welcome back!</h1>
        <p className="text-primary-foreground/90">
          {profile?.full_name || "Field Technician"}
        </p>
      </div>

      <div className="p-4 space-y-4">
        <ClockButton />

        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <Briefcase className="h-6 w-6 mx-auto mb-2 text-primary" />
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Today's Jobs</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-success" />
              <div className="text-2xl font-bold">{stats.completed}</div>
              <div className="text-xs text-muted-foreground">Completed</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Clock className="h-6 w-6 mx-auto mb-2 text-warning" />
              <div className="text-2xl font-bold">{stats.hoursWorked}</div>
              <div className="text-xs text-muted-foreground">Hours</div>
            </CardContent>
          </Card>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Today's Schedule</h2>
            <button
              onClick={() => navigate("/tasks")}
              className="text-sm text-primary hover:underline"
            >
              View all
            </button>
          </div>
          <div className="space-y-3">
            {jobs.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                  No jobs scheduled for today
                </CardContent>
              </Card>
            ) : (
              jobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onClick={() => navigate(`/tasks/${job.id}`)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default Home;