export interface ActionEvent {
  id: number;
  action_type: 'import' | 'export';
  level: string;
  status: string;
  message: string | null;
  processed_rows: number | null;
  total_rows: number | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface ImportAction {
  id: string;
  original_filename: string;
  status: string;
  total_rows: number;
  processed_rows: number;
  inserted_rows: number;
  updated_rows: number;
  unchanged_rows: number;
  warning_count: number;
  error_count: number;
  created_at: string;
  completed_at: string | null;
  warnings?: string[];
  errors?: string[];
}

export interface ImportStatus {
  completed: string;
  completed_with_warnings: string;
  failed: string;
}

export interface ExportAction {
  id: string;
  export_type: string;
  filters: {
    tables?: string[];
    format?: 'xlsx' | 'csv';
    cutoff?: string | null;
  };
  status: string;
  file_path: string | null;
  total_rows: number;
  processed_rows: number;
  created_at: string;
  completed_at: string | null;
  download_url: string | null;
}

export interface Department {
  id: string;
  parent_id: string | null;
  unit_type: 'department' | 'division';
  name: string;
  is_active: boolean;
}

export interface Employee {
  assignment_id: string;
  assignment_version_id: string;
  person_id: string;
  full_name: string;
  department_id: string | null;
  department_name: string | null;
  division_id: string | null;
  division_name: string | null;
  position_name: string;
  manager_person_id: string | null;
  manager_name: string | null;
  status: string;
  employment_type: string;
  hire_date: string;
  termination_date: string | null;
  salary: string | null;
  effective_from: string;
  effective_to: string | null;
  is_current: boolean;
}

export interface EmployeePayload {
  full_name: string;
  department_name: string;
  division_name?: string;
  position_name: string;
  manager_name?: string;
  status: string;
  employment_type: string;
  hire_date: string;
  termination_date?: string;
  salary?: string;
}
