import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleGuard from "./components/RoleGuard";
import Auth from "./pages/Auth";
import Home from "./pages/Home";
import Tasks from "./pages/Tasks";
import TaskDetail from "./pages/TaskDetail";
import Calendar from "./pages/Calendar";
import Profile from "./pages/Profile";
import SupervisorHome from "./pages/supervisor/SupervisorHome";
import JobManagement from "./pages/supervisor/JobManagement";
import JobScheduler from "./pages/supervisor/JobScheduler";
import PhotoApprovals from "./pages/supervisor/PhotoApprovals";
import Timesheets from "./pages/supervisor/Timesheets";
import TeamTracking from "./pages/supervisor/TeamTracking";
import Reports from "./pages/supervisor/Reports";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          
          {/* Staff Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tasks"
            element={
              <ProtectedRoute>
                <Tasks />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tasks/:id"
            element={
              <ProtectedRoute>
                <TaskDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/calendar"
            element={
              <ProtectedRoute>
                <Calendar />
              </ProtectedRoute>
            }
          />
          
          {/* Supervisor Routes */}
          <Route
            path="/supervisor"
            element={
              <ProtectedRoute>
                <RoleGuard allowedRoles={["supervisor", "manager"]}>
                  <SupervisorHome />
                </RoleGuard>
              </ProtectedRoute>
            }
          />
          <Route
            path="/supervisor/jobs"
            element={
              <ProtectedRoute>
                <RoleGuard allowedRoles={["supervisor", "manager"]}>
                  <JobManagement />
                </RoleGuard>
              </ProtectedRoute>
            }
          />
          <Route
            path="/supervisor/scheduler"
            element={
              <ProtectedRoute>
                <RoleGuard allowedRoles={["supervisor", "manager"]}>
                  <JobScheduler />
                </RoleGuard>
              </ProtectedRoute>
            }
          />
          <Route
            path="/supervisor/photos"
            element={
              <ProtectedRoute>
                <RoleGuard allowedRoles={["supervisor", "manager"]}>
                  <PhotoApprovals />
                </RoleGuard>
              </ProtectedRoute>
            }
          />
          <Route
            path="/supervisor/timesheets"
            element={
              <ProtectedRoute>
                <RoleGuard allowedRoles={["supervisor", "manager"]}>
                  <Timesheets />
                </RoleGuard>
              </ProtectedRoute>
            }
          />
          <Route
            path="/supervisor/tracking"
            element={
              <ProtectedRoute>
                <RoleGuard allowedRoles={["supervisor", "manager"]}>
                  <TeamTracking />
                </RoleGuard>
              </ProtectedRoute>
            }
          />
          <Route
            path="/supervisor/reports"
            element={
              <ProtectedRoute>
                <RoleGuard allowedRoles={["supervisor", "manager"]}>
                  <Reports />
                </RoleGuard>
              </ProtectedRoute>
            }
          />
          
          {/* Shared Routes */}
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
