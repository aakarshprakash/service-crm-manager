/** API shapes used by the manager app (subset of the web app's types). */

export type JobStatus = 'open' | 'in_progress' | 'pending' | 'completed' | 'cancelled';
export type Priority = 'low' | 'medium' | 'high';
export type PaymentMethod = 'cash' | 'upi' | 'cheque' | 'bank_transfer' | 'credit' | 'online';

export interface Named {
  id: number;
  name: string;
}

export interface Tenant {
  id: number;
  name: string;
  slug: string;
  timezone: string;
  currency: string;
  online_payments: boolean;
  manager_app?: boolean;
}

export interface User {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  role: 'admin' | 'coordinator' | 'accountant' | 'technician';
  role_label: string;
  branch_id: number | null;
  punch_status: 'in' | 'out';
  punched_at: string | null;
  abilities: string[];
  tenant: Tenant | null;
}

export interface StaffOption extends Named {
  role: string;
  branch_id: number | null;
  punch_status: 'in' | 'out';
  phone: string | null;
}

export interface Customer {
  id: number;
  crm_id: string | null;
  name: string;
  phone: string;
  alt_phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  pincode: string | null;
  lat: number | null;
  lng: number | null;
  branch_id: number | null;
  jobs_count?: number;
  products?: CustomerProduct[];
}

export interface CustomerProduct {
  id: number;
  serial_no: string | null;
  outdoor_serial_no: string | null;
  purchase_date: string | null;
  warranty_type: string | null;
  warranty_expiry: string | null;
  under_warranty?: boolean;
  product?: { id: number; model_name: string; brand?: Named | null } | null;
  dealer?: Named | null;
}

export interface Usage {
  id: number;
  quantity: number;
  unit_price: number;
  total_price: number;
  item?: { id: number; code: string; name: string; unit_of_measure: string };
}

export interface JobImage {
  id: number;
  job_visit_id: number | null;
  type: string;
  url: string;
}

export interface VoiceNote {
  id: number;
  job_visit_id: number | null;
  duration_seconds: number;
  url: string;
  created_at: string;
  uploader?: Named | null;
}

export interface Visit {
  id: number;
  service_type: string;
  start_time: string;
  end_time: string | null;
  duration_seconds: number | null;
  status: string;
  service_summary: string | null;
  labour_charge: number;
  spare_charge: number;
  total_charge: number;
  payment_method: PaymentMethod | null;
  amount_collected: number;
  location_lat: number | null;
  location_lng: number | null;
  signer_name?: string | null;
  signed_at?: string | null;
  technician?: Named;
  action_taken?: Named | null;
  inventory_usage?: Usage[];
}

export interface Payment {
  id: number;
  amount: number;
  method: PaymentMethod;
  receipt_number: string | null;
  reference_no: string | null;
  status: string;
  paid_at: string | null;
  collector?: Named | null;
}

export interface InvoiceItem {
  id: number;
  type: 'service' | 'part';
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  item?: { unit_of_measure: string } | null;
}

export interface Invoice {
  id: number;
  job_id: number | null;
  source: 'job' | 'walk_in';
  invoice_number: string;
  total_service_charge: number;
  total_spare_charge: number;
  discount_amount: number;
  total_amount: number;
  paid_amount: number;
  balance_amount: number;
  payment_status: 'unpaid' | 'partial' | 'paid';
  is_credit: boolean;
  generated_at: string;
  customer?: Customer;
  items?: InvoiceItem[];
  job?: { id: number; crm_call_id: string; technician?: Named | null; visits?: Visit[] };
  payments?: Payment[];
  pay_link?: string;
}

export interface Job {
  id: number;
  crm_call_id: string;
  customer_id: number;
  status: JobStatus;
  priority: Priority;
  call_type: string;
  service_type: string | null;
  scheduled_at: string | null;
  assigned_technician_id: number | null;
  complaint_details: string | null;
  cancel_reason: string | null;
  created_at: string;
  call_age_days: number | null;
  customer?: Customer;
  customer_product?: CustomerProduct | null;
  branch?: Named | null;
  service_location?: Named | null;
  complaint_type?: Named | null;
  complaint_summary?: Named | null;
  technician?: (Named & { phone?: string }) | null;
  creator?: Named | null;
  visits?: Visit[];
  images?: JobImage[];
  voice_notes?: VoiceNote[];
  status_history?: { id: number; status: JobStatus; remarks: string | null; changed_at: string; user?: Named | null }[];
  invoice?: Invoice | null;
  review?: { rating: number; comment: string | null } | null;
  parent?: { id: number; crm_call_id: string; status: JobStatus } | null;
  follow_ups?: { id: number; crm_call_id: string; status: JobStatus }[];
}

export interface ExpenseClaim {
  id: number;
  user_id: number;
  claim_date: string;
  amount: number;
  paid_from: 'cash_in_hand' | 'own_money';
  description: string | null;
  receipt_url: string | null;
  status: 'pending' | 'approved' | 'rejected';
  decision_note: string | null;
  cash_close_id: number | null;
  created_at: string;
  user?: Named;
  category?: Named | null;
  job?: { id: number; crm_call_id: string } | null;
  decider?: Named | null;
}

export interface LeaveRequest {
  id: number;
  user_id: number;
  from_date: string;
  to_date: string;
  half_day: boolean;
  days: number;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  decision_note: string | null;
  created_at: string;
  user?: Named & { role?: string };
  type?: Named | null;
  decider?: Named | null;
}

export interface CashClose {
  id: number;
  close_date: string;
  opening_balance: number;
  total_cash_collected: number;
  total_cheque_collected: number;
  total_digital_collected: number;
  total_expenses?: number;
  expected_in_hand: number;
  amount_confirmed: number;
  technician_remarks: string | null;
  amount_verified: number | null;
  discrepancy_amount: number;
  discrepancy_remarks: string | null;
  total_deposited: number;
  closing_balance: number;
  status: 'submitted' | 'verified' | 'closed';
  force_closed: boolean;
  submitted_at: string;
  verified_at: string | null;
  technician?: Named & { phone?: string };
  branch?: Named | null;
  verifier?: Named | null;
  deposits?: { id: number; amount: number; deposited_to: string; reference_no: string | null; deposit_date: string }[];
}

export interface CashPayment {
  id: number;
  receipt_number: string | null;
  method: PaymentMethod;
  amount: number;
  reference_no: string | null;
  paid_at: string;
  call_id: string | null;
  customer: string | null;
}

export interface StockRow {
  id: number;
  item_id: number;
  code: string;
  name: string;
  type: string;
  unit_of_measure: string;
  reorder_level: number;
  unit_price: number;
  quantity_available: number | string;
  branch_name: string;
  is_low: number | boolean;
}

export interface Lookups {
  branches: Named[];
  complaint_types: Named[];
  complaint_summaries: { id: number; name: string; complaint_type_id: number | null }[];
  service_locations: { id: number; name: string; city: string | null; pincodes: string | null }[];
}

export interface Dashboard {
  jobs: {
    by_status: Record<JobStatus, number>;
    unassigned: number;
    scheduled_today: number;
    overdue: number;
    created_this_month: number;
    trend: { date: string; created: number; completed: number }[];
  };
  revenue: { collected_this_month: number; by_method: Record<string, number>; outstanding: number; credit_outstanding: number; invoiced_this_month: number };
  technicians: {
    total: number;
    on_duty: number;
    performance: { id: number; name: string; completed: number; visits: number; revenue: number; rating: number | null }[];
  };
  inventory: { low_stock_count: number };
  cash: { pending_verification: number };
  rating: number;
}

export interface NotificationItem {
  id: number;
  type: string;
  title: string | null;
  message: string;
  data: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
}
