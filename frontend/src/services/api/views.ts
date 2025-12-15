import { apiFetch } from './client';
import type { View, SchemaResponse } from '../../types';

export const viewApi = {
    fetchSchema: () => apiFetch<SchemaResponse>('/api/schema'),

    fetchAll: () => apiFetch<View[]>('/api/schema/views'),

    get: (id: string) => apiFetch<{ name: string; query: string }>(`/api/schema/views/${id}`),

    create: (name: string, query: string, isMaterialized: boolean = false) =>
        apiFetch('/api/schema/views', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, query, is_materialized: isMaterialized }),
        }),

    update: (id: string, name: string, query: string, isMaterialized: boolean) =>
        apiFetch(`/api/schema/views/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, query, is_materialized: isMaterialized }),
        }),

    delete: (id: string) =>
        apiFetch(`/api/schema/views/${id}`, { method: 'DELETE' }),
};
