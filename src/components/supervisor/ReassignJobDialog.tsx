import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { UserCheck, Loader2 } from "lucide-react";

interface Staff {
  user_id: string;
  full_name: string;
}

interface ReassignJobDialogProps {
  job: {
    id: string;
    customer_name: string;
    assigned_to: string | null;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const ReassignJobDialog = ({
  job,
  open,
  onOpenChange,
  onSuccess,
}: ReassignJobDialogProps) => {
  const { toast } = useToast();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStaff, setLoadingStaff] = useState(true);

  useEffect(() => {
    if (open) {
      loadStaff();
      setSelectedStaff("");
      setNotes("");
    }
  }, [open]);

  const loadStaff = async () => {
    try {
      setLoadingStaff(true);
      
      // Get all staff users
      const { data: staffRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "staff");

      if (!staffRoles || staffRoles.length === 0) {
        setStaff([]);
        return;
      }

      const staffIds = staffRoles.map((r) => r.user_id);

      // Get profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", staffIds)
        .order("full_name");

      setStaff(profiles || []);
    } catch (error) {
      console.error("Error loading staff:", error);
      toast({
        title: "Error",
        description: "Failed to load staff members",
        variant: "destructive",
      });
    } finally {
      setLoadingStaff(false);
    }
  };

  const handleReassign = async () => {
    if (!job || !selectedStaff) return;

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Update job assignment
      const { error: updateError } = await supabase
        .from("jobs")
        .update({ 
          assigned_to: selectedStaff,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      if (updateError) throw updateError;

      // Get staff member's name
      const assignedStaff = staff.find((s) => s.user_id === selectedStaff);

      // Create notification for the new assignee
      const { error: notificationError } = await supabase
        .from("notifications")
        .insert({
          user_id: selectedStaff,
          title: "New Job Assigned",
          message: `You've been assigned to: ${job.customer_name}${
            notes ? `. Note: ${notes}` : ""
          }`,
          type: "job_assigned",
          related_job_id: job.id,
          created_by: user.id,
        });

      if (notificationError) {
        console.error("Error creating notification:", notificationError);
      }

      // If there was a previous assignee, notify them too
      if (job.assigned_to && job.assigned_to !== selectedStaff) {
        await supabase.from("notifications").insert({
          user_id: job.assigned_to,
          title: "Job Reassigned",
          message: `Job "${job.customer_name}" has been reassigned to ${
            assignedStaff?.full_name || "another team member"
          }`,
          type: "job_reassigned",
          related_job_id: job.id,
          created_by: user.id,
        });
      }

      toast({
        title: "Success",
        description: `Job reassigned to ${assignedStaff?.full_name}`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error reassigning job:", error);
      toast({
        title: "Error",
        description: "Failed to reassign job",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reassign Job</DialogTitle>
          <DialogDescription>
            Assign this job to a different team member
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Job:</h4>
            <p className="text-sm text-muted-foreground">{job?.customer_name}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="staff-select">Assign to *</Label>
            {loadingStaff ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <Select value={selectedStaff} onValueChange={setSelectedStaff}>
                <SelectTrigger id="staff-select">
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent>
                  {staff
                    .filter((s) => s.user_id !== job?.assigned_to)
                    .map((member) => (
                      <SelectItem key={member.user_id} value={member.user_id}>
                        {member.full_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes for the assigned staff member..."
              rows={3}
            />
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleReassign}
            className="flex-1"
            disabled={!selectedStaff || loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Reassigning...
              </>
            ) : (
              <>
                <UserCheck className="mr-2 h-4 w-4" />
                Reassign
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
