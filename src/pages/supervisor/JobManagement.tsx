import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SupervisorBottomNav from "@/components/supervisor/SupervisorBottomNav";
import JobForm from "@/components/supervisor/JobForm";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Plus, Filter } from "lucide-react";

interface Job {
  id: string;
  customer_name: string;
  customer_address: string;
  job_description: string;
  scheduled_start: string;
  status: string;
  priority: string;
  assigned_to: string | null;
  profiles?: {
    full_name: string;
  };
}

const JobManagement = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  useEffect(() => {
    if (searchParams.get("create") === "true") {
      setShowCreateDialog(true);
      searchParams.delete("create");
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    loadJobs();
  }, [statusFilter, priorityFilter]);

  const loadJobs = async () => {
    try {
      let query = supabase
        .from("jobs")
        .select("*")
        .order("scheduled_start", { ascending: true });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      if (priorityFilter !== "all") {
        query = query.eq("priority", priorityFilter);
      }

      const { data: jobsData, error } = await query;

      if (error) throw error;

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

      setJobs(jobsWithProfiles);
    } catch (error) {
      console.error("Error loading jobs:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredJobs = jobs.filter(
    (job) =>
      job.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.customer_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.job_description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-success/10 text-success border-success/20";
      case "in_progress":
        return "bg-primary/10 text-primary border-primary/20";
      case "pending":
        return "bg-warning/10 text-warning border-warning/20";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "text-destructive";
      case "high":
        return "text-warning";
      case "medium":
        return "text-primary";
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
      <div className="max-w-lg mx-auto p-4 space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Job Management</h1>
            <p className="text-sm text-muted-foreground">{filteredJobs.length} jobs</p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Job
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by customer or address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="flex-1">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Jobs List */}
        <div className="space-y-3">
          {filteredJobs.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No jobs found</p>
            </Card>
          ) : (
            filteredJobs.map((job) => (
              <Card
                key={job.id}
                className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => navigate(`/tasks/${job.id}`)}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">{job.customer_name}</h3>
                    <p className="text-sm text-muted-foreground">{job.customer_address}</p>
                  </div>
                  <span className={`text-xs font-semibold ${getPriorityColor(job.priority)}`}>
                    {job.priority?.toUpperCase()}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {job.job_description}
                </p>
                <div className="flex items-center justify-between">
                  <div className="text-xs">
                    <p className="text-muted-foreground">
                      Assigned: {job.profiles?.full_name || "Unassigned"}
                    </p>
                    <p className="text-muted-foreground">
                      {new Date(job.scheduled_start).toLocaleDateString()} at{" "}
                      {new Date(job.scheduled_start).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                      job.status
                    )}`}
                  >
                    {job.status?.replace("_", " ")}
                  </span>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Job</DialogTitle>
          </DialogHeader>
          <JobForm
            onSuccess={() => {
              setShowCreateDialog(false);
              loadJobs();
            }}
            onCancel={() => setShowCreateDialog(false)}
          />
        </DialogContent>
      </Dialog>

      <SupervisorBottomNav />
    </div>
  );
};

export default JobManagement;
