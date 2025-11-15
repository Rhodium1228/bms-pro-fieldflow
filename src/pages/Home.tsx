import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/BottomNav";
import ClockButton from "@/components/ClockButton";
import JobCard from "@/components/JobCard";
import { Card, CardContent } from "@/components/ui/card";
import { Briefcase, CheckCircle2, Clock, TrendingUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { XPBar } from "@/components/gamification/XPBar";
import { StreakCounter } from "@/components/gamification/StreakCounter";
import { useGamification } from "@/hooks/useGamification";

interface Job {
  id: string;
  customer_name: string;
  customer_address: string;
  job_description: string;
  scheduled_start: string;
  status: string;
  priority: string;
  work_progress?: Array<{ item: string; completed: boolean }>;
  work_completion?: number;
}

interface Profile {
  full_name: string;
}

const Home = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState({ total: 0, completed: 0, hoursWorked: 0 });
  const [workProgress, setWorkProgress] = useState({ percentage: 0, completedItems: 0, totalItems: 0, jobsWithProgress: 0 });
  const [progressUpdated, setProgressUpdated] = useState(false);
  const navigate = useNavigate();
  const gamification = useGamification();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const setupRealtimeSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Subscribe to real-time updates for jobs
      const channel = supabase
        .channel('jobs-changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'jobs',
            filter: `assigned_to=eq.${user.id}`
          },
          (payload) => {
            console.log('Job updated:', payload);
            // Reload data when a job is updated
            loadData();
          }
        )
        .subscribe();

      return channel;
    };

    let channelPromise = setupRealtimeSubscription();

    return () => {
      channelPromise.then((channel) => {
        if (channel) supabase.removeChannel(channel);
      });
    };
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
      setJobs(jobsData as unknown as Job[]);
      const completed = jobsData.filter((j) => j.status === "completed").length;
      setStats((prev) => ({ ...prev, total: jobsData.length, completed }));

      // Calculate overall work progress for today's jobs
      const jobsWithWorkProgress = jobsData.filter((job) => {
        const workProgress = job.work_progress as any;
        return workProgress && Array.isArray(workProgress) && workProgress.length > 0;
      });

      if (jobsWithWorkProgress.length > 0) {
        let totalWorkItems = 0;
        let completedWorkItems = 0;

        jobsWithWorkProgress.forEach((job) => {
          const workItems = (job.work_progress as any) || [];
          if (Array.isArray(workItems)) {
            totalWorkItems += workItems.length;
            completedWorkItems += workItems.filter((item: any) => item.completed).length;
          }
        });

        const overallPercentage = totalWorkItems > 0 
          ? Math.round((completedWorkItems / totalWorkItems) * 100) 
          : 0;

        setWorkProgress((prev) => {
          const hasChanged = prev.percentage !== overallPercentage;
          if (hasChanged) {
            setProgressUpdated(true);
            setTimeout(() => setProgressUpdated(false), 1000);
          }
          return {
            percentage: overallPercentage,
            completedItems: completedWorkItems,
            totalItems: totalWorkItems,
            jobsWithProgress: jobsWithWorkProgress.length,
          };
        });
      }
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
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 pb-20">
      <div className="bg-gradient-to-r from-primary to-accent text-primary-foreground p-6 rounded-b-3xl shadow-2xl animate-slide-in">
        <h1 className="text-3xl font-bold mb-2">
          Welcome back! 👋
        </h1>
        <p className="text-primary-foreground/90 text-base">
          {profile?.full_name || "Field Technician"}
        </p>
      </div>

      <div className="p-4 space-y-5">
        {/* Gamification Section */}
        <Card className="glass neuro-shadow animate-bounce-in">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <XPBar 
                currentXP={gamification.xp} 
                level={gamification.level} 
                xpToNextLevel={gamification.xpToNextLevel} 
              />
            </div>
            <StreakCounter streak={gamification.streak} />
          </CardContent>
        </Card>

        <ClockButton />

        {workProgress.jobsWithProgress > 0 && (
          <Card className="bg-gradient-to-r from-primary/10 to-accent/10 glass neuro-shadow animate-slide-in">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg">Today's Progress</h3>
                </div>
                <span className="text-3xl font-bold text-primary">{workProgress.percentage}%</span>
              </div>
              <Progress value={workProgress.percentage} className="h-4 mb-3" />
              <div className="flex items-center justify-between text-sm text-muted-foreground font-medium">
                <span>
                  🎯 {workProgress.completedItems} of {workProgress.totalItems} tasks crushed!
                </span>
                <span>
                  {workProgress.jobsWithProgress} {workProgress.jobsWithProgress === 1 ? 'job' : 'jobs'}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-3 gap-3">
          <Card className="glass neuro-shadow hover:scale-105 transition-transform animate-bounce-in" style={{ animationDelay: '0.1s' }}>
            <CardContent className="p-5 text-center">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-3">
                <Briefcase className="h-6 w-6 text-primary" />
              </div>
              <div className="text-3xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground font-medium">Today's Jobs</div>
            </CardContent>
          </Card>
          <Card className="glass neuro-shadow hover:scale-105 transition-transform animate-bounce-in" style={{ animationDelay: '0.2s' }}>
            <CardContent className="p-5 text-center">
              <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="h-6 w-6 text-success" />
              </div>
              <div className="text-3xl font-bold">{stats.completed}</div>
              <div className="text-xs text-muted-foreground font-medium">Completed</div>
            </CardContent>
          </Card>
          <Card className="glass neuro-shadow hover:scale-105 transition-transform animate-bounce-in" style={{ animationDelay: '0.3s' }}>
            <CardContent className="p-5 text-center">
              <div className="w-12 h-12 rounded-full bg-warning/20 flex items-center justify-center mx-auto mb-3">
                <Clock className="h-6 w-6 text-warning" />
              </div>
              <div className="text-3xl font-bold">{stats.hoursWorked}</div>
              <div className="text-xs text-muted-foreground font-medium">Hours</div>
            </CardContent>
          </Card>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4 animate-slide-in">
            <h2 className="text-2xl font-bold">Today's Schedule 📋</h2>
            <button
              onClick={() => navigate("/tasks")}
              className="text-sm text-primary hover:underline font-semibold hover:scale-110 transition-transform"
            >
              View All →
            </button>
          </div>
          <div className="space-y-3">
            {jobs.length === 0 ? (
              <Card className="glass neuro-shadow animate-bounce-in">
                <CardContent className="p-8 text-center">
                  <div className="text-4xl mb-3">🎉</div>
                  <p className="text-muted-foreground font-medium">No jobs scheduled for today</p>
                  <p className="text-sm text-muted-foreground mt-2">Enjoy your free time!</p>
                </CardContent>
              </Card>
            ) : (
              jobs.map((job, index) => (
                <div 
                  key={job.id} 
                  className="animate-slide-in cursor-pointer hover:scale-102 transition-transform" 
                  style={{ animationDelay: `${index * 0.1}s` }}
                  onClick={() => navigate(`/tasks/${job.id}`)}
                >
                  <JobCard
                    job={job}
                    onClick={() => navigate(`/tasks/${job.id}`)}
                  />
                </div>
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