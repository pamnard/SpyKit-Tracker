import { apiFetch } from './client';
import type { PixelSettings } from '../../types';

export const settingsApi = {
    fetch: () => apiFetch<PixelSettings>('/api/settings'),

    update: (settings: PixelSettings) =>
        apiFetch('/api/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings),
        }),
};
