import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, MapPin, Calendar, Clock, CheckCircle2, Play, Navigation } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import PhotoUpload from "@/components/PhotoUpload";
import Checklist from "@/components/Checklist";
import SignaturePad from "@/components/SignaturePad";
import { useSoundEffects } from "@/hooks/useSoundEffects";
import { useGamification } from "@/hooks/useGamification";
import { Confetti } from "@/components/Confetti";
import { usePushNotifications } from "@/hooks/usePushNotifications";

interface ChecklistItem {
  item: string;
  completed: boolean;
  quantity?: number;
}

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
  safety_checklist: ChecklistItem[];
  materials_checklist: ChecklistItem[];
  work_progress: ChecklistItem[];
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
  const [photos, setPhotos] = useState<string[]>([]);
  const [safetyChecklist, setSafetyChecklist] = useState<ChecklistItem[]>([]);
  const [materialsChecklist, setMaterialsChecklist] = useState<ChecklistItem[]>([]);
  const [workProgress, setWorkProgress] = useState<ChecklistItem[]>([]);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const { playSound } = useSoundEffects();
  const gamification = useGamification();
  const pushNotifications = usePushNotifications();

  const triggerHaptic = (type: 'light' | 'medium' | 'heavy' = 'medium') => {
    if ('vibrate' in navigator) {
      const patterns = {
        light: 10,
        medium: 20,
        heavy: [30, 10, 30]
      };
      navigator.vibrate(patterns[type]);
    }
  };

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
      setJob(data as any);
      setNotes(data.notes || "");
      setSafetyChecklist((data.safety_checklist as any) || []);
      setMaterialsChecklist((data.materials_checklist as any) || []);
      setWorkProgress((data.work_progress as any) || []);
      setSignatureUrl(data.signature_url || null);
    }

    // Load existing job photos from job_updates
    const { data: updates } = await supabase
      .from("job_updates")
      .select("photo_urls")
      .eq("job_id", id)
      .not("photo_urls", "is", null);

    if (updates && updates.length > 0) {
      const allPhotos = updates.flatMap(u => u.photo_urls || []);
      setPhotos(allPhotos);
    }
  };

  const handleSafetyChecklistUpdate = async (items: ChecklistItem[]) => {
    setSafetyChecklist(items);
    if (job) {
      await supabase
        .from("jobs")
        .update({ safety_checklist: items as any })
        .eq("id", job.id);
    }
  };

  const handleMaterialsChecklistUpdate = async (items: ChecklistItem[]) => {
    setMaterialsChecklist(items);
    if (job) {
      await supabase
        .from("jobs")
        .update({ materials_checklist: items as any })
        .eq("id", job.id);
    }
  };

  const handleWorkProgressUpdate = async (items: ChecklistItem[]) => {
    setWorkProgress(items);
    if (job) {
      // Calculate work completion percentage
      const totalItems = items.length;
      const completedItems = items.filter(item => item.completed).length;
      const workCompletion = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

      // Check if a new item was completed
      const previousCompleted = workProgress.filter(item => item.completed).length;
      if (completedItems > previousCompleted) {
        playSound('success');
        triggerHaptic('light');
        
        // Award XP for completing tasks
        const result = gamification.addXP(20);
        if (result.leveledUp) {
          playSound('levelUp');
          pushNotifications.notifyLevelUp(result.newLevel, result.newXP);
          toast({
            title: "🎉 Level Up!",
            description: `You've reached level ${result.newLevel}!`,
          });
        }
      }

      await supabase
        .from("jobs")
        .update({ 
          work_progress: items as any,
          work_completion: workCompletion
        })
        .eq("id", job.id);
    }
  };

  const updateStatus = async (newStatus: string) => {
    if (!job) return;

    // Check for signature requirement on completion
    if (newStatus === "completed" && !signatureUrl) {
      setShowSignaturePad(true);
      return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    const updateData: any = { 
      status: newStatus, 
      notes 
    };

    // Add completion metadata when completing job
    if (newStatus === "completed") {
      updateData.completed_at = new Date().toISOString();
      updateData.completed_by = user?.id;
      updateData.signature_url = signatureUrl;
    }

    const { error } = await supabase
      .from("jobs")
      .update(updateData)
      .eq("id", job.id);

    if (error) {
      playSound('error');
      triggerHaptic('heavy');
      toast({
        title: "Error",
        description: "Failed to update job status",
        variant: "destructive",
      });
    } else {
      // Success feedback based on status
      if (newStatus === "completed") {
        playSound('achievement');
        triggerHaptic('heavy');
        setShowConfetti(true);
        
        // Award XP for job completion
        const scheduledEnd = job.scheduled_end ? new Date(job.scheduled_end) : null;
        const now = new Date();
        const completedEarly = scheduledEnd && now < scheduledEnd;
        
        const xpAmount = completedEarly ? 50 : 30;
        const result = gamification.addXP(xpAmount);
        
        if (result.leveledUp) {
          playSound('levelUp');
          pushNotifications.notifyLevelUp(result.newLevel, result.newXP);
        }
        
        // Check for achievements
        const taskMasterResult = gamification.addAchievement('task_master');
        if (taskMasterResult.isNew && taskMasterResult.achievement) {
          playSound('achievement');
          pushNotifications.notifyAchievement(
            taskMasterResult.achievement.name,
            taskMasterResult.achievement.description
          );
        }
        
        // Track completed jobs for achievements
        const completedJobs = parseInt(localStorage.getItem('completedJobs') || '0') + 1;
        localStorage.setItem('completedJobs', completedJobs.toString());
        
        // Check for 5-Star Technician achievement
        if (completedJobs >= 20) {
          const fiveStarResult = gamification.addAchievement('five_star');
          if (fiveStarResult.isNew && fiveStarResult.achievement) {
            playSound('achievement');
            pushNotifications.notifyAchievement(
              fiveStarResult.achievement.name,
              fiveStarResult.achievement.description
            );
          }
        }
        
        // Track early completions for Speed Demon achievement
        if (completedEarly) {
          const earlyCompletions = parseInt(localStorage.getItem('earlyCompletions') || '0') + 1;
          localStorage.setItem('earlyCompletions', earlyCompletions.toString());
          
          if (earlyCompletions >= 5) {
            const speedDemonResult = gamification.addAchievement('speed_demon');
            if (speedDemonResult.isNew && speedDemonResult.achievement) {
              playSound('achievement');
              pushNotifications.notifyAchievement(
                speedDemonResult.achievement.name,
                speedDemonResult.achievement.description
              );
            }
          }
        }
        
        toast({
          title: "🎉 Job Completed!",
          description: `Great work! ${completedEarly ? 'Completed early! ' : ''}+${xpAmount} XP${result.leveledUp ? ` - Level ${result.newLevel}!` : ''}`,
        });
      } else if (newStatus === "in_progress") {
        playSound('success');
        triggerHaptic('medium');
        toast({
          title: "⚡ Job Started",
          description: "Let's get to work!",
        });
      } else {
        playSound('click');
        triggerHaptic('light');
        toast({
          title: "Status updated",
          description: `Job marked as ${newStatus.replace("_", " ")}`,
        });
      }

      if (user) {
        await supabase.from("job_updates").insert({
          job_id: job.id,
          user_id: user.id,
          update_type: newStatus,
          notes,
          photo_urls: photos.length > 0 ? photos : null,
        });
      }

      loadJob();
    }
    setLoading(false);
  };

  const handleSignatureSave = (url: string) => {
    setSignatureUrl(url);
    setShowSignaturePad(false);
    
    // Automatically complete the job after signature
    if (job) {
      updateStatus("completed");
    }
  };

  if (!job) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 pb-6">
      <div className="bg-gradient-to-r from-primary to-accent text-primary-foreground p-6 rounded-b-3xl shadow-2xl animate-slide-in">
        <div className="flex items-center gap-3 mb-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="text-primary-foreground hover:bg-primary-foreground/20 hover:scale-110 transition-transform"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold">Job Details</h1>
        </div>
        <Badge className={cn("mt-2 font-semibold text-base", statusColors[job.status as keyof typeof statusColors])}>
          {job.status === 'in_progress' && '⚡ '}
          {job.status === 'completed' && '✅ '}
          {job.status.replace("_", " ").toUpperCase()}
        </Badge>
      </div>

      <div className="p-4 space-y-5">
        <Card className="glass neuro-shadow animate-slide-in">
          <CardHeader>
            <CardTitle className="text-2xl">{job.customer_name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <MapPin className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <span className="text-sm font-medium">{job.customer_address}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full hover:scale-105 transition-transform"
                asChild
              >
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(job.customer_address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Navigation className="mr-2 h-4 w-4" />
                  Navigate to Location
                </a>
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary shrink-0" />
              <span className="text-sm font-medium">
                {format(new Date(job.scheduled_start), "EEEE, MMMM d, yyyy")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary shrink-0" />
              <span className="text-sm font-medium">
                {format(new Date(job.scheduled_start), "h:mm a")}
                {job.scheduled_end &&
                  ` - ${format(new Date(job.scheduled_end), "h:mm a")}`}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="glass neuro-shadow animate-slide-in" style={{ animationDelay: '0.1s' }}>
          <CardHeader>
            <CardTitle className="text-lg">📝 Job Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground font-medium leading-relaxed">{job.job_description}</p>
          </CardContent>
        </Card>

        <Card className="glass neuro-shadow animate-slide-in" style={{ animationDelay: '0.2s' }}>
          <CardHeader>
            <CardTitle className="text-lg">💭 Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Add notes about this job..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="resize-none text-base"
            />
          </CardContent>
        </Card>

        <Card className="glass neuro-shadow animate-slide-in" style={{ animationDelay: '0.3s' }}>
          <CardHeader>
            <CardTitle className="text-lg">📸 Job Photos</CardTitle>
          </CardHeader>
          <CardContent>
            <PhotoUpload
              jobId={job.id}
              existingPhotos={photos}
              onPhotosUpdate={setPhotos}
              label="Add Photos"
            />
          </CardContent>
        </Card>

        {workProgress.length > 0 && (
          <Checklist
            title="Work Progress"
            items={workProgress}
            onUpdate={handleWorkProgressUpdate}
          />
        )}

        <Checklist
          title="Safety Requirements"
          items={safetyChecklist}
          onUpdate={handleSafetyChecklistUpdate}
        />

        <Checklist
          title="Tasks"
          items={materialsChecklist}
          onUpdate={handleMaterialsChecklistUpdate}
          showQuantity
        />

        {showSignaturePad && (
          <SignaturePad
            onSignatureSave={handleSignatureSave}
            onCancel={() => setShowSignaturePad(false)}
            label="Customer Signature Required"
          />
        )}

        {signatureUrl && !showSignaturePad && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Completion Signature</CardTitle>
            </CardHeader>
            <CardContent>
              <img 
                src={signatureUrl} 
                alt="Customer signature" 
                className="w-full border border-border rounded-lg bg-background p-2"
              />
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {job.status === "pending" && (
            <Button
              onClick={() => updateStatus("in_progress")}
              disabled={loading}
              className="w-full hover:scale-105 transition-all shadow-lg animate-bounce-in"
              size="lg"
            >
              <Play className="mr-2 h-5 w-5" />
              ⚡ Start Job
            </Button>
          )}
          {job.status === "in_progress" && (
            <Button
              onClick={() => updateStatus("completed")}
              disabled={loading}
              className="w-full hover:scale-105 transition-all shadow-lg animate-pulse-glow"
              size="lg"
            >
              <CheckCircle2 className="mr-2 h-5 w-5" />
              🎉 Complete Job
            </Button>
          )}
          {job.status !== "completed" && (
            <Button
              onClick={() => updateStatus("cancelled")}
              disabled={loading}
              variant="outline"
              className="w-full hover:scale-105 transition-transform"
            >
              Cancel Job
            </Button>
          )}
        </div>
      </div>

      {/* Confetti Animation on Job Completion */}
      <Confetti show={showConfetti} onComplete={() => setShowConfetti(false)} />
    </div>
  );
};

export default TaskDetail;