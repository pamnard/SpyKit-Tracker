import { apiFetch } from './client';
import type { ReportMeta, ReportResponse, Report } from '../../types';

export const reportApi = {
    fetchAll: () => apiFetch<ReportMeta[]>('/api/reports'),

    get: (id: string) => apiFetch<ReportResponse>(`/api/reports/${id}`),

    create: (title: string, widgets: string[] = []) =>
        apiFetch<Report>('/api/reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, widgets }),
        }),

    update: (id: string, title: string, widgets: string[]) =>
        apiFetch(`/api/reports/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, title, widgets }),
        }),

    delete: (id: string) =>
        apiFetch(`/api/reports/${id}`, { method: 'DELETE' }),
};
