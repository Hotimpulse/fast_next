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
