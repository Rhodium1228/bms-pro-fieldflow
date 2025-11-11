import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

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
      console.error("Error loading staff:", error);
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
        materials_required: data.materials_required || "",
        safety_requirements: data.safety_requirements || "",
      });
    } catch (error) {
      console.error("Error loading job:", error);
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
      const { data: { user } } = await supabase.auth.getUser();
      
      const scheduledStart = new Date(
        `${formData.scheduled_date}T${formData.scheduled_time}`
      ).toISOString();

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
        created_by: user?.id,
        status: "pending",
      };

      if (jobId) {
        const { error } = await supabase
          .from("jobs")
          .update(jobData)
          .eq("id", jobId);

        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Job updated successfully",
        });
      } else {
        const { error } = await supabase
          .from("jobs")
          .insert([jobData]);

        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Job created successfully",
        });
      }

      onSuccess();
    } catch (error) {
      console.error("Error saving job:", error);
      toast({
        title: "Error",
        description: "Failed to save job",
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
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="safety_requirements">Safety Requirements</Label>
        <Textarea
          id="safety_requirements"
          value={formData.safety_requirements}
          onChange={(e) => setFormData({ ...formData, safety_requirements: e.target.value })}
          rows={2}
        />
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
