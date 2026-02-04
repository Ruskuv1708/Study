// 1. The Department (New Concept)
export interface Department {
  id: string;
  name: string;
  description: string | null;
  tenant_id: string;
}

// 2. The Request (Updated)
export interface RequestItem {
  id: string;
  title: string;
  description: string | null;
  status: "new" | "assigned" | "in_progress" | "pending_approval" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "critical";
  created_at: string;
  department_id: string; // <--- New Link
  assigned_to_id: string | null;
}

// 3. Payload to Create a Department
export interface DepartmentCreatePayload {
  name: string;
  description: string;
}

// 4. Payload to Create a Request
export interface RequestCreatePayload {
  title: string;
  description: string;
  priority: string;
  department_id: string; // <--- Mandatory now
}