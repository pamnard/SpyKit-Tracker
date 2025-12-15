import { apiFetch } from './client';

export const authApi = {
    login: (username: string, password: string) =>
        apiFetch<{ token: string; username: string; role: string }>('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        }),
};
