import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/BottomNav";
import JobCard from "@/components/JobCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";

interface Job {
  id: string;
  customer_name: string;
  customer_address: string;
  job_description: string;
  scheduled_start: string;
  status: string;
  priority: string;
}

const Tasks = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filter, setFilter] = useState<"all" | "today" | "upcoming" | "completed">("today");
  const navigate = useNavigate();

  useEffect(() => {
    loadJobs();
  }, [filter]);

  const loadJobs = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let query = supabase
      .from("jobs")
      .select("*")
      .eq("assigned_to", user.id)
      .order("scheduled_start", { ascending: true });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (filter === "today") {
      query = query
        .gte("scheduled_start", today.toISOString())
        .lt("scheduled_start", tomorrow.toISOString());
    } else if (filter === "upcoming") {
      query = query.gte("scheduled_start", tomorrow.toISOString());
    } else if (filter === "completed") {
      query = query.eq("status", "completed");
    }

    const { data } = await query;
    if (data) {
      setJobs(data);
    }
  };

  const filteredJobs = jobs.filter((job) => {
    if (filter === "completed") return job.status === "completed";
    if (filter === "all") return true;
    return true;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 pb-20">
      <div className="bg-gradient-to-r from-primary to-accent text-primary-foreground p-6 rounded-b-3xl shadow-2xl animate-slide-in">
        <h1 className="text-3xl font-bold">Tasks 📋</h1>
        <p className="text-primary-foreground/90 text-base">Stay on top of your assignments</p>
      </div>

      <div className="p-4">
        <Tabs
          value={filter}
          onValueChange={(value) => setFilter(value as typeof filter)}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-4 mb-6 h-12 glass neuro-shadow">
            <TabsTrigger value="today" className="font-semibold">Today</TabsTrigger>
            <TabsTrigger value="upcoming" className="font-semibold">Upcoming</TabsTrigger>
            <TabsTrigger value="completed" className="font-semibold">Done</TabsTrigger>
            <TabsTrigger value="all" className="font-semibold">All</TabsTrigger>
          </TabsList>

          <TabsContent value={filter} className="space-y-3 mt-0">
            {filteredJobs.length === 0 ? (
              <Card className="glass neuro-shadow animate-bounce-in">
                <CardContent className="p-8 text-center">
                  <div className="text-4xl mb-3">🔍</div>
                  <p className="text-muted-foreground font-medium">No jobs found</p>
                  <p className="text-sm text-muted-foreground mt-2">Try a different filter</p>
                </CardContent>
              </Card>
            ) : (
              filteredJobs.map((job, index) => (
                <div 
                  key={job.id}
                  className="animate-slide-in hover:scale-102 transition-transform"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <JobCard
                    job={job}
                    onClick={() => navigate(`/tasks/${job.id}`)}
                  />
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      <BottomNav />
    </div>
  );
};

export default Tasks;