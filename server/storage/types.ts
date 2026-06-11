export interface NotificationItem {
  id: string;
  type: 'inbound' | 'booking' | 'error';
  title: string;
  description: string;
  at: string; // ISO date string
  leadId?: number;
}

export interface ProspectsListParams {
  limit?: number;
  offset?: number;
  search?: string;
  niche?: string[];
  status?: string[];
  country?: string[];
  priority?: string[];
  source?: string[];
  overdue?: boolean;
  sortBy?: string; // "recent" | "name_asc" | "name_desc" | "priority"
  groupBy?: string;
  groupDirection?: "asc" | "desc";
  all?: boolean;
}
