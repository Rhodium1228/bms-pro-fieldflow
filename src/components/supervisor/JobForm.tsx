import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { z } from "zod";

interface JobFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  jobId?: string;
}

interface StaffMember {
  user_id: string;
  profiles: {
    full_name: string;
  };
}

const jobSchema = z.object({
  customer_email: z.string().email({ message: "Invalid email format" }).max(255).or(z.literal('')),
  customer_phone: z.string().regex(/^[0-9+\-\s()]*$/, { message: "Invalid phone format" }).max(20).optional().or(z.literal('')),
  customer_name: z.string().trim().min(1, { message: "Customer name is required" }).max(200),
  customer_address: z.string().trim().min(1, { message: "Address is required" }).max(500),
  job_description: z.string().trim().min(10, { message: "Description must be at least 10 characters" }).max(2000),
  materials_required: z.string().max(2000).optional().or(z.literal('')),
  safety_requirements: z.string().max(2000).optional().or(z.literal('')),
  job_type: z.string().optional(),
  priority: z.string().optional(),
  assigned_to: z.string().optional().or(z.literal('')),
  scheduled_date: z.string().min(1, { message: "Date is required" }),
  scheduled_time: z.string().min(1, { message: "Time is required" }),
  estimated_duration: z.string().optional(),
  work_items: z.string().optional(),
});

const JobForm = ({ onSuccess, onCancel, jobId }: JobFormProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [formData, setFormData] = useState({
    customer_name: "",
    customer_address: "",
    customer_phone: "",
    customer_email: "",
    job_description: "",
    job_type: "maintenance",
    priority: "medium",
    estimated_duration: "2",
    assigned_to: "",
    scheduled_date: "",
    scheduled_time: "",
    materials_required: "",
    safety_requirements: "",
    work_items: "",
  });

  useEffect(() => {
    loadStaffMembers();
    if (jobId) {
      loadJobData();
    }
  }, [jobId]);

  const loadStaffMembers = async () => {
    try {
      const { data: staffRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "staff");

      if (rolesError) throw rolesError;

      const userIds = staffRoles?.map(r => r.user_id) || [];
      
      if (userIds.length === 0) {
        setStaffMembers([]);
        return;
      }

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

      if (profilesError) throw profilesError;

      const staffWithProfiles = profiles?.map(p => ({
        user_id: p.user_id,
        profiles: { full_name: p.full_name }
      })) || [];

      setStaffMembers(staffWithProfiles);
    } catch (error) {
      // Error loading staff members
    }
  };

  const loadJobData = async () => {
    if (!jobId) return;
    
    try {
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", jobId)
        .single();

      if (error) throw error;
      
      const scheduledDate = new Date(data.scheduled_start);
      
      // Convert checklist arrays back to comma-separated strings for editing
      const safetyItems = Array.isArray(data.safety_checklist) 
        ? data.safety_checklist.map((item: any) => item.item).join(", ")
        : data.safety_requirements || "";
      
      const materialsItems = Array.isArray(data.materials_checklist)
        ? data.materials_checklist.map((item: any) => item.item).join(", ")
        : data.materials_required || "";
      
      const workItems = Array.isArray(data.work_progress)
        ? data.work_progress.map((item: any) => item.item).join(", ")
        : "";
      
      setFormData({
        customer_name: data.customer_name,
        customer_address: data.customer_address,
        customer_phone: data.customer_phone || "",
        customer_email: data.customer_email || "",
        job_description: data.job_description,
        job_type: data.job_type || "maintenance",
        priority: data.priority || "medium",
        estimated_duration: data.estimated_duration?.toString() || "2",
        assigned_to: data.assigned_to || "",
        scheduled_date: scheduledDate.toISOString().split("T")[0],
        scheduled_time: scheduledDate.toTimeString().slice(0, 5),
        materials_required: materialsItems,
        safety_requirements: safetyItems,
        work_items: workItems,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load job data",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error("Not authenticated. Please log in again.");
      }
      
      // Validate form data with zod
      const validationResult = jobSchema.safeParse(formData);
      
      if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        toast({
          title: "Validation Error",
          description: firstError.message,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      
      const scheduledStart = new Date(
        `${formData.scheduled_date}T${formData.scheduled_time}`
      ).toISOString();

      // Convert comma-separated text to checklist format with max 50 items
      const safetyChecklist = formData.safety_requirements
        .split(",")
        .map(item => item.trim())
        .filter(item => item.length > 0)
        .slice(0, 50)
        .map(item => ({ item: item.substring(0, 200), completed: false }));

      const materialsChecklist = formData.materials_required
        .split(",")
        .map(item => item.trim())
        .filter(item => item.length > 0)
        .slice(0, 50)
        .map(item => ({ item: item.substring(0, 200), completed: false, quantity: 1 }));

      const workProgress = formData.work_items
        .split(",")
        .map(item => item.trim())
        .filter(item => item.length > 0)
        .slice(0, 50)
        .map(item => ({ item: item.substring(0, 200), completed: false }));

      const jobData = {
        customer_name: formData.customer_name,
        customer_address: formData.customer_address,
        customer_phone: formData.customer_phone || null,
        customer_email: formData.customer_email || null,
        job_description: formData.job_description,
        job_type: formData.job_type,
        priority: formData.priority,
        estimated_duration: parseFloat(formData.estimated_duration),
        assigned_to: formData.assigned_to || null,
        scheduled_start: scheduledStart,
        materials_required: formData.materials_required || null,
        safety_requirements: formData.safety_requirements || null,
        safety_checklist: safetyChecklist as any,
        materials_checklist: materialsChecklist as any,
        work_progress: workProgress as any,
        created_by: user.id,
        status: "pending",
      };

      if (jobId) {
        const { error, data } = await supabase
          .from("jobs")
          .update(jobData)
          .eq("id", jobId)
          .select();

        if (error) {
          throw error;
        }
        
        toast({
          title: "Success",
          description: "Job updated successfully",
        });
      } else {
        const { error, data } = await supabase
          .from("jobs")
          .insert([jobData])
          .select();

        if (error) {
          if (error.message.includes("row-level security")) {
            throw new Error("Permission denied. You may not have supervisor privileges.");
          }
          throw error;
        }
        
        toast({
          title: "Success",
          description: "Job created successfully",
        });
      }

      onSuccess();
    } catch (error: any) {
      let errorMessage = "Failed to save job";
      if (error.message) {
        errorMessage = error.message;
      } else if (error.code === "PGRST301") {
        errorMessage = "Permission denied. You may not have supervisor privileges.";
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
      <div className="space-y-2">
        <Label htmlFor="customer_name">Customer Name *</Label>
        <Input
          id="customer_name"
          required
          value={formData.customer_name}
          onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="customer_address">Customer Address *</Label>
        <Input
          id="customer_address"
          required
          value={formData.customer_address}
          onChange={(e) => setFormData({ ...formData, customer_address: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="customer_phone">Phone</Label>
          <Input
            id="customer_phone"
            type="tel"
            value={formData.customer_phone}
            onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="customer_email">Email</Label>
          <Input
            id="customer_email"
            type="email"
            value={formData.customer_email}
            onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="job_description">Job Description *</Label>
        <Textarea
          id="job_description"
          required
          value={formData.job_description}
          onChange={(e) => setFormData({ ...formData, job_description: e.target.value })}
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="job_type">Job Type</Label>
          <Select value={formData.job_type} onValueChange={(value) => setFormData({ ...formData, job_type: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="installation">Installation</SelectItem>
              <SelectItem value="repair">Repair</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
              <SelectItem value="inspection">Inspection</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="priority">Priority</Label>
          <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="scheduled_date">Date *</Label>
          <Input
            id="scheduled_date"
            type="date"
            required
            value={formData.scheduled_date}
            onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="scheduled_time">Time *</Label>
          <Input
            id="scheduled_time"
            type="time"
            required
            value={formData.scheduled_time}
            onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="estimated_duration">Duration (hours)</Label>
          <Input
            id="estimated_duration"
            type="number"
            step="0.5"
            value={formData.estimated_duration}
            onChange={(e) => setFormData({ ...formData, estimated_duration: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="assigned_to">Assign Technician</Label>
          <Select value={formData.assigned_to} onValueChange={(value) => setFormData({ ...formData, assigned_to: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select technician" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Unassigned</SelectItem>
              {staffMembers.map((staff) => (
                <SelectItem key={staff.user_id} value={staff.user_id}>
                  {staff.profiles.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="materials_required">Materials Required</Label>
        <Textarea
          id="materials_required"
          value={formData.materials_required}
          onChange={(e) => setFormData({ ...formData, materials_required: e.target.value })}
          rows={2}
          placeholder="Enter items separated by commas (e.g., Wire cutters, Electrical tape, 2x4 lumber)"
        />
        <p className="text-xs text-muted-foreground">Separate items with commas</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="safety_requirements">Safety Requirements</Label>
        <Textarea
          id="safety_requirements"
          value={formData.safety_requirements}
          onChange={(e) => setFormData({ ...formData, safety_requirements: e.target.value })}
          rows={2}
          placeholder="Enter requirements separated by commas (e.g., Hard hat, Safety glasses, Harness)"
        />
        <p className="text-xs text-muted-foreground">Separate items with commas</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="work_items">Work Items to Complete</Label>
        <Textarea
          id="work_items"
          value={formData.work_items}
          onChange={(e) => setFormData({ ...formData, work_items: e.target.value })}
          rows={3}
          placeholder="Enter specific work items (e.g., Fan Installation Complete, Dishwasher Repair, HVAC Filter Replacement, Electrical Panel Inspection)"
        />
        <p className="text-xs text-muted-foreground">
          Separate items with commas. Common examples: Fan Installation, Dishwasher Repair, AC Unit Service, Furnace Maintenance, Water Heater Repair, Plumbing Fix, Electrical Wiring
        </p>
      </div>

      <div className="flex gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" disabled={loading} className="flex-1">
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {jobId ? "Update Job" : "Create Job"}
        </Button>
      </div>
    </form>
  );
};

export default JobForm;
