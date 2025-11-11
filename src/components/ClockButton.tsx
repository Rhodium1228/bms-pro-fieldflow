import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Clock, Coffee } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface ClockEntry {
  id: string;
  clock_in: string;
  clock_out: string | null;
  break_start: string | null;
  break_end: string | null;
}

const ClockButton = () => {
  const [activeEntry, setActiveEntry] = useState<ClockEntry | null>(null);
  const [isOnBreak, setIsOnBreak] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    checkActiveEntry();
  }, []);

  const checkActiveEntry = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("clock_entries")
      .select("*")
      .eq("user_id", user.id)
      .is("clock_out", null)
      .order("clock_in", { ascending: false })
      .limit(1)
      .single();

    if (!error && data) {
      setActiveEntry(data);
      setIsOnBreak(data.break_start && !data.break_end);
    }
  };

  const handleClockIn = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("clock_entries").insert({
      user_id: user.id,
      clock_in: new Date().toISOString(),
    });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to clock in",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Clocked in",
      description: `Welcome! Clocked in at ${format(new Date(), "h:mm a")}`,
    });
    checkActiveEntry();
  };

  const handleClockOut = async () => {
    if (!activeEntry) return;

    const { error } = await supabase
      .from("clock_entries")
      .update({ clock_out: new Date().toISOString() })
      .eq("id", activeEntry.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to clock out",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Clocked out",
      description: `See you tomorrow! Clocked out at ${format(new Date(), "h:mm a")}`,
    });
    setActiveEntry(null);
    setIsOnBreak(false);
  };

  const handleBreak = async () => {
    if (!activeEntry) return;

    if (isOnBreak) {
      const { error } = await supabase
        .from("clock_entries")
        .update({ break_end: new Date().toISOString() })
        .eq("id", activeEntry.id);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to end break",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Break ended",
        description: "Back to work!",
      });
      setIsOnBreak(false);
    } else {
      const { error } = await supabase
        .from("clock_entries")
        .update({ break_start: new Date().toISOString() })
        .eq("id", activeEntry.id);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to start break",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Break started",
        description: "Enjoy your break!",
      });
      setIsOnBreak(true);
    }
  };

  if (!activeEntry) {
    return (
      <Button onClick={handleClockIn} size="lg" className="w-full">
        <Clock className="mr-2 h-5 w-5" />
        Clock In
      </Button>
    );
  }

  return (
    <div className="flex gap-2">
      <Button
        onClick={handleBreak}
        variant={isOnBreak ? "default" : "outline"}
        className="flex-1"
      >
        <Coffee className="mr-2 h-4 w-4" />
        {isOnBreak ? "End Break" : "Start Break"}
      </Button>
      <Button onClick={handleClockOut} variant="destructive" className="flex-1">
        <Clock className="mr-2 h-4 w-4" />
        Clock Out
      </Button>
    </div>
  );
};

export default ClockButton;