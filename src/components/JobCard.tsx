import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar, Clock } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface JobCardProps {
  job: {
    id: string;
    customer_name: string;
    customer_address: string;
    job_description: string;
    scheduled_start: string;
    status: string;
    priority: string;
  };
  onClick: () => void;
}

const statusColors = {
  pending: "bg-muted text-muted-foreground",
  in_progress: "bg-primary text-primary-foreground",
  completed: "bg-success text-success-foreground",
  cancelled: "bg-destructive text-destructive-foreground",
};

const priorityColors = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-warning text-warning-foreground",
  high: "bg-destructive text-destructive-foreground",
};

const JobCard = ({ job, onClick }: JobCardProps) => {
  return (
    <Card
      className="cursor-pointer hover:shadow-lg transition-all duration-300 hover:scale-[1.02] glass neuro-shadow border-l-4 border-l-primary"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg truncate">
              {job.customer_name}
            </h3>
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1 font-medium">
              {job.job_description}
            </p>
          </div>
          <Badge className={cn("shrink-0 font-semibold", priorityColors[job.priority as keyof typeof priorityColors])}>
            {job.priority === 'high' && '🔥 '}
            {job.priority.toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center text-sm">
          <MapPin className="mr-2 h-4 w-4 shrink-0 text-primary" />
          <span className="truncate font-medium text-muted-foreground">{job.customer_address}</span>
        </div>
        <div className="flex items-center text-sm">
          <Calendar className="mr-2 h-4 w-4 shrink-0 text-primary" />
          <span className="font-medium text-muted-foreground">{format(new Date(job.scheduled_start), "MMM d, yyyy")}</span>
        </div>
        <div className="flex items-center text-sm">
          <Clock className="mr-2 h-4 w-4 shrink-0 text-primary" />
          <span className="font-medium text-muted-foreground">{format(new Date(job.scheduled_start), "h:mm a")}</span>
        </div>
        <div className="flex items-center justify-between pt-2">
          <Badge className={cn("font-semibold", statusColors[job.status as keyof typeof statusColors])}>
            {job.status === 'in_progress' && '⚡ '}
            {job.status === 'completed' && '✅ '}
            {job.status.replace("_", " ").toUpperCase()}
          </Badge>
          <span className="text-primary font-bold text-sm">View →</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default JobCard;