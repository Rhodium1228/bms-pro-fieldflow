import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import SupervisorBottomNav from "@/components/supervisor/SupervisorBottomNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

interface ClockEntry {
  id: string;
  user_id: string;
  clock_in: string;
  clock_out: string | null;
  break_duration: number | null;
  total_hours: number | null;
  approval_status: string;
  approval_notes: string | null;
  profiles?: {
    full_name: string;
  };
}

interface StaffTimesheets {
  user_id: string;
  full_name: string;
  total_hours: number;
  pending_count: number;
  approved_count: number;
  entries: ClockEntry[];
}

const Timesheets = () => {
  const { toast } = useToast();
  const [staffTimesheets, setStaffTimesheets] = useState<StaffTimesheets[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffTimesheets | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<ClockEntry | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    loadTimesheets();
  }, [dateRange]);

  const loadTimesheets = async () => {
    try {
      // Get all staff users
      const { data: staffRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "staff");

      if (!staffRoles) return;

      const staffIds = staffRoles.map(r => r.user_id);

      // Get profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", staffIds);

      // Get clock entries for date range
      const { data: entries } = await supabase
        .from("clock_entries")
        .select("*")
        .in("user_id", staffIds)
        .gte("clock_in", `${dateRange.start}T00:00:00`)
        .lte("clock_in", `${dateRange.end}T23:59:59`)
        .order("clock_in", { ascending: false });

      // Group by staff
      const grouped: { [key: string]: StaffTimesheets } = {};

      profiles?.forEach((profile) => {
        grouped[profile.user_id] = {
          user_id: profile.user_id,
          full_name: profile.full_name,
          total_hours: 0,
          pending_count: 0,
          approved_count: 0,
          entries: [],
        };
      });

      entries?.forEach((entry) => {
        if (grouped[entry.user_id]) {
          // Calculate hours
          if (entry.clock_in && entry.clock_out) {
            const hours = (new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / (1000 * 60 * 60);
            entry.total_hours = hours;
          }

          grouped[entry.user_id].entries.push(entry);
          grouped[entry.user_id].total_hours += entry.total_hours || 0;
          
          if (entry.approval_status === "pending") {
            grouped[entry.user_id].pending_count++;
          } else if (entry.approval_status === "approved") {
            grouped[entry.user_id].approved_count++;
          }
        }
      });

      setStaffTimesheets(Object.values(grouped));
    } catch (error) {
      console.error("Error loading timesheets:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (entryId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("clock_entries")
        .update({
          approval_status: "approved",
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", entryId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Timesheet entry approved",
      });

      loadTimesheets();
    } catch (error) {
      console.error("Error approving entry:", error);
      toast({
        title: "Error",
        description: "Failed to approve entry",
        variant: "destructive",
      });
    }
  };

  const handleReject = async () => {
    if (!selectedEntry) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("clock_entries")
        .update({
          approval_status: "rejected",
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
          approval_notes: rejectNotes,
        })
        .eq("id", selectedEntry.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Timesheet entry rejected",
      });

      setShowRejectDialog(false);
      setRejectNotes("");
      loadTimesheets();
    } catch (error) {
      console.error("Error rejecting entry:", error);
      toast({
        title: "Error",
        description: "Failed to reject entry",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-success text-white">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const hasAnomaly = (entry: ClockEntry) => {
    if (!entry.total_hours) return false;
    return entry.total_hours > 12 || !entry.clock_out;
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
        <div>
          <h1 className="text-2xl font-bold text-foreground">Timesheet Approval</h1>
          <p className="text-sm text-muted-foreground">Review and approve staff timesheets</p>
        </div>

        {/* Date Range Filter */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Start Date</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-md border bg-background"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">End Date</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-md border bg-background"
            />
          </div>
        </div>

        {/* Staff List */}
        <div className="space-y-3">
          {staffTimesheets.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No timesheets found for this period</p>
            </Card>
          ) : (
            staffTimesheets.map((staff) => (
              <Card
                key={staff.user_id}
                className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => {
                  setSelectedStaff(staff);
                  setShowDetailDialog(true);
                }}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold text-foreground">{staff.full_name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {staff.total_hours.toFixed(1)} hours total
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-warning">{staff.pending_count} pending</p>
                    <p className="text-xs text-success">{staff.approved_count} approved</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {staff.pending_count > 0 && (
                    <Badge variant="outline" className="text-warning border-warning">
                      {staff.pending_count} pending
                    </Badge>
                  )}
                  {staff.entries.some(hasAnomaly) && (
                    <Badge variant="outline" className="text-destructive border-destructive">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Anomalies
                    </Badge>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedStaff?.full_name}'s Timesheets</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {selectedStaff?.entries.map((entry) => (
              <Card key={entry.id} className={`p-4 ${hasAnomaly(entry) ? "border-warning" : ""}`}>
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {new Date(entry.clock_in).toLocaleDateString()}
                    </span>
                  </div>
                  {getStatusBadge(entry.approval_status)}
                </div>
                <div className="space-y-1 text-sm">
                  <p className="text-muted-foreground">
                    In: {new Date(entry.clock_in).toLocaleTimeString()}
                  </p>
                  <p className="text-muted-foreground">
                    Out: {entry.clock_out ? new Date(entry.clock_out).toLocaleTimeString() : "Not clocked out"}
                  </p>
                  {entry.total_hours && (
                    <p className="font-semibold">
                      Hours: {entry.total_hours.toFixed(2)}
                    </p>
                  )}
                  {hasAnomaly(entry) && (
                    <p className="text-warning text-xs flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {entry.total_hours && entry.total_hours > 12 ? "Over 12 hours" : "Missing clock out"}
                    </p>
                  )}
                  {entry.approval_notes && (
                    <p className="text-xs text-muted-foreground italic">
                      Note: {entry.approval_notes}
                    </p>
                  )}
                </div>
                {entry.approval_status === "pending" && (
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleApprove(entry.id);
                      }}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEntry(entry);
                        setShowRejectDialog(true);
                      }}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Timesheet Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Reason for Rejection</label>
              <Textarea
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                placeholder="Enter reason for rejection..."
                rows={4}
                className="mt-2"
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowRejectDialog(false)} className="flex-1">
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleReject} className="flex-1" disabled={!rejectNotes}>
                Reject
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <SupervisorBottomNav />
    </div>
  );
};

export default Timesheets;
