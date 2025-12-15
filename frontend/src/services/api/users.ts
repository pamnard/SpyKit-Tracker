import { apiFetch } from './client';
import type { User } from '../../types';

export const userApi = {
    fetchAll: () => apiFetch<User[]>('/api/users'),

    create: (user: User) =>
        apiFetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(user),
        }),
};
