import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, MapPin, Calendar, Clock, CheckCircle2, Play } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Job {
  id: string;
  customer_name: string;
  customer_address: string;
  job_description: string;
  scheduled_start: string;
  scheduled_end: string | null;
  status: string;
  priority: string;
  notes: string | null;
}

const statusColors = {
  pending: "bg-muted text-muted-foreground",
  in_progress: "bg-primary text-primary-foreground",
  completed: "bg-success text-success-foreground",
  cancelled: "bg-destructive text-destructive-foreground",
};

const TaskDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [job, setJob] = useState<Job | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (id) {
      loadJob();
    }
  }, [id]);

  const loadJob = async () => {
    const { data } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", id)
      .single();

    if (data) {
      setJob(data);
      setNotes(data.notes || "");
    }
  };

  const updateStatus = async (newStatus: string) => {
    if (!job) return;

    setLoading(true);
    const { error } = await supabase
      .from("jobs")
      .update({ status: newStatus, notes })
      .eq("id", job.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update job status",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Status updated",
        description: `Job marked as ${newStatus.replace("_", " ")}`,
      });

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("job_updates").insert({
          job_id: job.id,
          user_id: user.id,
          update_type: newStatus,
          notes,
        });
      }

      loadJob();
    }
    setLoading(false);
  };

  if (!job) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      <div className="bg-primary text-primary-foreground p-6 rounded-b-3xl shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="text-primary-foreground hover:bg-primary-foreground/20"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Job Details</h1>
        </div>
        <Badge className={cn("mt-2", statusColors[job.status as keyof typeof statusColors])}>
          {job.status.replace("_", " ")}
        </Badge>
      </div>

      <div className="p-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>{job.customer_name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-2">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
              <span className="text-sm">{job.customer_address}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-muted-foreground shrink-0" />
              <span className="text-sm">
                {format(new Date(job.scheduled_start), "EEEE, MMMM d, yyyy")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground shrink-0" />
              <span className="text-sm">
                {format(new Date(job.scheduled_start), "h:mm a")}
                {job.scheduled_end &&
                  ` - ${format(new Date(job.scheduled_end), "h:mm a")}`}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Job Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{job.job_description}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Add notes about this job..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </CardContent>
        </Card>

        <div className="space-y-2">
          {job.status === "pending" && (
            <Button
              onClick={() => updateStatus("in_progress")}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              <Play className="mr-2 h-5 w-5" />
              Start Job
            </Button>
          )}
          {job.status === "in_progress" && (
            <Button
              onClick={() => updateStatus("completed")}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              <CheckCircle2 className="mr-2 h-5 w-5" />
              Complete Job
            </Button>
          )}
          {job.status !== "completed" && (
            <Button
              onClick={() => updateStatus("cancelled")}
              disabled={loading}
              variant="outline"
              className="w-full"
            >
              Cancel Job
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskDetail;