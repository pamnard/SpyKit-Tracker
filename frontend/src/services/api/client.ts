const apiUrl = (import.meta.env.VITE_API_URL).replace(/\/$/, '');

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
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
