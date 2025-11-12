import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "staff" | "supervisor" | "manager";

export const useUserRole = () => {
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setRole(null);
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        if (error) {
          console.error("Error fetching user roles:", error);
          setRole(null);
        } else {
          const roles = (data?.map((r: { role: string }) => r.role) ?? []) as AppRole[];
          // Priority: manager > supervisor > staff
          if (roles.includes("manager")) setRole("manager");
          else if (roles.includes("supervisor")) setRole("supervisor");
          else if (roles.includes("staff")) setRole("staff");
          else setRole(null);
        }
      } catch (error) {
        console.error("Error in fetchUserRole:", error);
        setRole(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();
  }, []);

  return { role, loading };
};
