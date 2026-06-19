import type {
  ImportAction,
  ActionEvent,
  Department,
  Employee,
  EmployeePayload,
  ExportAction,
  ClearDatabaseResult,
  ReferenceField,
  ReferenceMutationResult,
  ReferenceValue,
} from './types';

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000').replace(/\/$/, '');
export const WS_URL = API_URL.replace(/^http/, 'ws');

function formatErrorDetail(detail: unknown): string | null {
  if (!detail) return null;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && 'msg' in item) return String(item.msg);
        return JSON.stringify(item);
      })
      .join(' ');
  }
  if (typeof detail === 'object' && 'msg' in detail) return String(detail.msg);
  return JSON.stringify(detail);
}

async function readError(response: Response) {
  try {
    const body = (await response.json()) as { detail?: unknown };
    return formatErrorDetail(body.detail) ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, init);
  if (!response.ok) throw new Error(await readError(response));
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function downloadUrl(path: string) {
  return `${API_URL}${path}`;
}

export function progressPercent(event?: ActionEvent) {
  if (!event?.total_rows) return 0;
  return Math.round(((event.processed_rows ?? 0) / event.total_rows) * 100);
}

export const Api = {
  imports: () => api<ImportAction[]>('/imports'),
  import: (id: string) => api<ImportAction>(`/imports/${id}`),
  uploadImport: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api<ImportAction>('/imports?async_mode=true', { method: 'POST', body: form });
  },
  importEvents: (id: string) => api<ActionEvent[]>(`/imports/${id}/events`),
  departments: () => api<Department[]>('/departments'),
  references: (field: ReferenceField, includeInactive = true) =>
    api<ReferenceValue[]>(`/references?field=${field}&include_inactive=${includeInactive}`),
  createReference: (field: ReferenceField, value: string, parentValue?: string) =>
    api<ReferenceMutationResult>('/references', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field, value, parent_value: parentValue || null }),
    }),
  renameReference: (field: ReferenceField, oldValue: string, newValue: string) =>
    api<ReferenceMutationResult>('/references/rename', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field, old_value: oldValue, new_value: newValue }),
    }),
  removeReference: (field: ReferenceField, value: string) =>
    api<ReferenceMutationResult>('/references', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field, value }),
    }),
  employees: (query: URLSearchParams) => api<Employee[]>(`/employees?${query}`),
  employee: (id: string, cutoff?: string) => {
    const query = new URLSearchParams();
    if (cutoff) query.set('cutoff', cutoff);
    return api<Employee>(`/employees/${id}${query.size ? `?${query}` : ''}`);
  },
  createEmployee: (payload: EmployeePayload) =>
    api<Employee>('/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  updateEmployee: (id: string, payload: EmployeePayload) =>
    api<Employee>(`/employees/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  deleteEmployee: (id: string) => api<void>(`/employees/${id}`, { method: 'DELETE' }),
  exports: () => api<ExportAction[]>('/exports/history'),
  export: (id: string) => api<ExportAction>(`/exports/${id}`),
  startExport: (tables: string[], format: 'xlsx' | 'csv', cutoff?: string) =>
    api<ExportAction>('/exports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tables, format, cutoff: cutoff || null }),
    }),
  clearDb: () => api<ClearDatabaseResult>('/admin/clear-db', { method: 'POST' }),
};
