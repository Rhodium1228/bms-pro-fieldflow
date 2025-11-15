import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Clock, MapPin } from "lucide-react";
import SupervisorBottomNav from "@/components/supervisor/SupervisorBottomNav";

interface PhotoApproval {
  id: string;
  job_update_id: string;
  photo_url: string;
  status: "pending" | "approved" | "rejected";
  comments: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  job_updates: {
    job_id: string;
    user_id: string;
    update_type: string;
    notes: string | null;
    jobs: {
      customer_name: string;
      customer_address: string;
      job_description: string;
    };
    profiles: {
      full_name: string;
    };
  };
}

const PhotoApprovals = () => {
  const [photos, setPhotos] = useState<PhotoApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [comments, setComments] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const loadPhotos = async () => {
    try {
      const { data, error } = await supabase
        .from("photo_approvals")
        .select(`
          *,
          job_updates!inner(
            job_id,
            user_id,
            update_type,
            notes,
            jobs!inner(
              customer_name,
              customer_address,
              job_description
            )
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch user profiles separately
      const userIds = Array.from(new Set((data || []).map(p => p.job_updates.user_id)));
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]));

      const enrichedData = (data || []).map(photo => ({
        ...photo,
        job_updates: {
          ...photo.job_updates,
          profiles: {
            full_name: profileMap.get(photo.job_updates.user_id) || "Unknown"
          }
        }
      }));

      setPhotos(enrichedData as PhotoApproval[]);
    } catch (error) {
      console.error("Error loading photos:", error);
      toast({
        title: "Error",
        description: "Failed to load photos for review",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPhotos();

    // Real-time subscription
    const channel = supabase
      .channel("photo-approvals-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "photo_approvals",
        },
        () => {
          loadPhotos();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleApprove = async (photoId: string, jobUpdateData: PhotoApproval["job_updates"]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error: updateError } = await supabase
        .from("photo_approvals")
        .update({
          status: "approved",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          comments: comments[photoId] || null,
        })
        .eq("id", photoId);

      if (updateError) throw updateError;

      // Send notification to staff
      const { error: notifError } = await supabase
        .from("notifications")
        .insert({
          user_id: jobUpdateData.user_id,
          title: "Photo Approved",
          message: `Your photo for ${jobUpdateData.jobs.customer_name} has been approved${comments[photoId] ? `: ${comments[photoId]}` : ""}`,
          type: "success",
          related_job_id: jobUpdateData.job_id,
          created_by: user.id,
        });

      if (notifError) throw notifError;

      toast({
        title: "Photo Approved",
        description: "Staff member has been notified",
      });

      setComments((prev) => {
        const newComments = { ...prev };
        delete newComments[photoId];
        return newComments;
      });
    } catch (error) {
      console.error("Error approving photo:", error);
      toast({
        title: "Error",
        description: "Failed to approve photo",
        variant: "destructive",
      });
    }
  };

  const handleReject = async (photoId: string, jobUpdateData: PhotoApproval["job_updates"]) => {
    if (!comments[photoId]) {
      toast({
        title: "Comment Required",
        description: "Please add a comment explaining why the photo needs to be retaken",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error: updateError } = await supabase
        .from("photo_approvals")
        .update({
          status: "rejected",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          comments: comments[photoId],
        })
        .eq("id", photoId);

      if (updateError) throw updateError;

      // Send notification to staff
      const { error: notifError } = await supabase
        .from("notifications")
        .insert({
          user_id: jobUpdateData.user_id,
          title: "Photo Needs Retake",
          message: `Photo for ${jobUpdateData.jobs.customer_name} needs to be retaken: ${comments[photoId]}`,
          type: "warning",
          related_job_id: jobUpdateData.job_id,
          created_by: user.id,
        });

      if (notifError) throw notifError;

      toast({
        title: "Photo Rejected",
        description: "Staff member has been notified to retake the photo",
      });

      setComments((prev) => {
        const newComments = { ...prev };
        delete newComments[photoId];
        return newComments;
      });
    } catch (error) {
      console.error("Error rejecting photo:", error);
      toast({
        title: "Error",
        description: "Failed to reject photo",
        variant: "destructive",
      });
    }
  };

  const filteredPhotos = photos.filter((photo) => photo.status === activeTab);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
      case "approved":
        return <Badge className="bg-green-500 gap-1"><CheckCircle className="h-3 w-3" /> Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Rejected</Badge>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="container mx-auto p-4">
          <p className="text-muted-foreground">Loading photos...</p>
        </div>
        <SupervisorBottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container mx-auto p-4 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Photo Approvals</h1>
          <p className="text-muted-foreground">Review and approve job photos submitted by staff</p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pending">
              Pending ({photos.filter((p) => p.status === "pending").length})
            </TabsTrigger>
            <TabsTrigger value="approved">
              Approved ({photos.filter((p) => p.status === "approved").length})
            </TabsTrigger>
            <TabsTrigger value="rejected">
              Rejected ({photos.filter((p) => p.status === "rejected").length})
            </TabsTrigger>
          </TabsList>

          {["pending", "approved", "rejected"].map((tab) => (
            <TabsContent key={tab} value={tab} className="space-y-4">
              {filteredPhotos.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center text-muted-foreground">
                    No {tab} photos
                  </CardContent>
                </Card>
              ) : (
                filteredPhotos.map((photo) => (
                  <Card key={photo.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-lg">
                            {photo.job_updates.jobs.customer_name}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {photo.job_updates.jobs.job_description}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="h-4 w-4" />
                            {photo.job_updates.jobs.customer_address}
                          </div>
                          <p className="text-sm font-medium">
                            By: {photo.job_updates.profiles.full_name}
                          </p>
                        </div>
                        {getStatusBadge(photo.status)}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-muted">
                        <img
                          src={photo.photo_url}
                          alt="Job photo"
                          className="h-full w-full object-cover"
                        />
                      </div>

                      {photo.job_updates.notes && (
                        <div className="rounded-md bg-muted p-3">
                          <p className="text-sm font-medium mb-1">Job Update Notes:</p>
                          <p className="text-sm text-muted-foreground">{photo.job_updates.notes}</p>
                        </div>
                      )}

                      {photo.status === "pending" && (
                        <div className="space-y-3">
                          <Textarea
                            placeholder="Add comments (required for rejection, optional for approval)..."
                            value={comments[photo.id] || ""}
                            onChange={(e) =>
                              setComments((prev) => ({ ...prev, [photo.id]: e.target.value }))
                            }
                            rows={3}
                          />
                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleApprove(photo.id, photo.job_updates)}
                              className="flex-1"
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Approve
                            </Button>
                            <Button
                              onClick={() => handleReject(photo.id, photo.job_updates)}
                              variant="destructive"
                              className="flex-1"
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Request Retake
                            </Button>
                          </div>
                        </div>
                      )}

                      {photo.comments && photo.status !== "pending" && (
                        <div className="rounded-md bg-muted p-3">
                          <p className="text-sm font-medium mb-1">Review Comments:</p>
                          <p className="text-sm text-muted-foreground">{photo.comments}</p>
                        </div>
                      )}

                      {photo.reviewed_at && (
                        <p className="text-xs text-muted-foreground">
                          Reviewed {new Date(photo.reviewed_at).toLocaleString()}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
      <SupervisorBottomNav />
    </div>
  );
};

export default PhotoApprovals;
