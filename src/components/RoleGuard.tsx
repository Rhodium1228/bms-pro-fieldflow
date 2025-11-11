import { useUserRole, AppRole } from "@/hooks/useUserRole";
import { Loader2 } from "lucide-react";
import { Navigate } from "react-router-dom";

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: AppRole[];
}

const RoleGuard = ({ children, allowedRoles }: RoleGuardProps) => {
  const { role, loading } = useUserRole();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!role || !allowedRoles.includes(role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default RoleGuard;
