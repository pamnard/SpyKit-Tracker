import { apiFetch } from './client';
import type { Widget } from '../../types';

export const widgetApi = {
    fetchAll: () => apiFetch<Widget[]>('/api/widgets'),

    getData: async (id: string, range?: { from?: string; to?: string }) => {
        const params = new URLSearchParams();
        if (range?.from) params.set('from', range.from);
        if (range?.to) params.set('to', range.to);
        const qs = params.toString();
        const res = await apiFetch<{ value: number; from: string; to: string }>(
            `/api/widgets/${id}${qs ? `?${qs}` : ''}`,
        );
        return res;
    },

    create: (w: Widget) =>
        apiFetch('/api/widgets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(w),
        }),

    update: (w: Widget) =>
        apiFetch(`/api/widgets/${w.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(w),
        }),

    delete: (id: string) =>
        apiFetch(`/api/widgets/${id}`, { method: 'DELETE' }),
};
