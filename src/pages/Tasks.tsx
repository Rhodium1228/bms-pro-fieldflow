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
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-primary text-primary-foreground p-6 rounded-b-3xl shadow-lg">
        <h1 className="text-2xl font-bold">Tasks</h1>
        <p className="text-primary-foreground/90">Manage your job assignments</p>
      </div>

      <div className="p-4">
        <Tabs
          value={filter}
          onValueChange={(value) => setFilter(value as typeof filter)}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="completed">Done</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>

          <TabsContent value={filter} className="space-y-3 mt-0">
            {filteredJobs.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                  No jobs found for this filter
                </CardContent>
              </Card>
            ) : (
              filteredJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onClick={() => navigate(`/tasks/${job.id}`)}
                />
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