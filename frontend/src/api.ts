import { ReportMeta, ReportResponse, Report, Widget, SchemaResponse, View, PixelSettings } from './types';

const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);
    const token = localStorage.getItem('auth_token');
    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }

    const res = await fetch(`${apiUrl}${path}`, {
        ...init,
        headers,
    });

    if (res.status === 401) {
        localStorage.removeItem('auth_token');
        throw new Error('Unauthorized');
    }

    if (!res.ok) {
        let errorMessage = `HTTP ${res.status}`;
        try {
            const errorBody = await res.json();
            if (errorBody.detail) {
                errorMessage = errorBody.detail;
            } else if (errorBody.error) {
                errorMessage = errorBody.error;
            }
        } catch (e) {
            // Ignore JSON parse error, use status text
        }
        throw new Error(errorMessage);
    }
    return (await res.json()) as T;
}

export const login = (username: string, password: string) =>
    apiFetch<{ token: string; username: string; role: string }>('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    });

export interface User {
    username: string;
    role: string;
    password?: string;
}

export const fetchUsers = () => apiFetch<User[]>('/api/users');

export const createUser = (user: User) =>
    apiFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
    });

export const fetchSchema = () => apiFetch<SchemaResponse>('/api/schema');

export const fetchViews = () => apiFetch<View[]>('/api/schema/views');

export const createView = (name: string, query: string, isMaterialized: boolean = false) =>
    apiFetch('/api/schema/views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, query, is_materialized: isMaterialized }),
    });

export const fetchView = (id: string) => apiFetch<{ name: string; query: string }>(`/api/schema/views/${id}`);

export const updateView = (id: string, name: string, query: string, isMaterialized: boolean) =>
    apiFetch(`/api/schema/views/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, query, is_materialized: isMaterialized }),
    });

export const deleteView = (id: string) =>
    apiFetch(`/api/schema/views/${id}`, { method: 'DELETE' });

export const fetchReports = () => apiFetch<ReportMeta[]>('/api/reports');
export const fetchReport = (id: string) => apiFetch<ReportResponse>(`/api/reports/${id}`);
export const fetchWidgetData = async (id: string, range?: { from?: string; to?: string }) => {
    const params = new URLSearchParams();
    if (range?.from) params.set('from', range.from);
    if (range?.to) params.set('to', range.to);
    const qs = params.toString();
    const res = await apiFetch<{ value: number; from: string; to: string }>(
        `/api/widgets/${id}${qs ? `?${qs}` : ''}`,
    );
    return res;
};
export const fetchWidgets = () => apiFetch<Widget[]>('/api/widgets');

export const createWidget = (w: Widget) =>
    apiFetch('/api/widgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(w),
    });

export const updateWidget = (w: Widget) =>
    apiFetch(`/api/widgets/${w.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(w),
    });

export const deleteWidget = (id: string) =>
    apiFetch(`/api/widgets/${id}`, { method: 'DELETE' });

export const updateReport = (id: string, title: string, widgets: string[]) =>
    apiFetch(`/api/reports/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, title, widgets }),
    });

export const createReport = (title: string, widgets: string[] = []) =>
    apiFetch<Report>('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, widgets }),
    });

export const deleteReport = (id: string) =>
    apiFetch(`/api/reports/${id}`, { method: 'DELETE' });

export const fetchSettings = () => apiFetch<PixelSettings>('/api/settings');

export const updateSettings = (settings: PixelSettings) =>
    apiFetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
    });
