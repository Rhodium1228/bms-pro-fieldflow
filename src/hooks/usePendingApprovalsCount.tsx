import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const usePendingApprovalsCount = () => {
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchPendingCount = async () => {
    try {
      const { count, error } = await supabase
        .from("clock_entries")
        .select("*", { count: "exact", head: true })
        .eq("approval_status", "pending");

      if (error) throw error;
      setPendingCount(count || 0);
    } catch (error) {
      console.error("Error fetching pending count:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingCount();

    // Set up real-time subscription
    const channel = supabase
      .channel('clock-entries-approval-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'clock_entries',
          filter: 'approval_status=eq.pending'
        },
        () => {
          fetchPendingCount();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'clock_entries'
        },
        () => {
          fetchPendingCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { pendingCount, loading };
};
