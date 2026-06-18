import type { ImportAction, ActionEvent } from './types';

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000').replace(/\/$/, '');
export const WS_URL = API_URL.replace(/^http/, 'ws');

async function readError(response: Response) {
  try {
    const body = (await response.json()) as { detail?: string };
    return body.detail ?? response.statusText;
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
};
