import React, { createContext, useContext, useEffect, useState } from 'react';
import * as api from '../api';

interface User {
    username: string;
    role: string;
}

interface AuthContextType {
    user: User | null;
    login: (u: string, p: string) => Promise<void>;
    logout: () => void;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('auth_token');
        const username = localStorage.getItem('auth_username');
        const role = localStorage.getItem('auth_role');

        if (token && username && role) {
            setUser({ username, role });
        }
        setIsLoading(false);
    }, []);

    const login = async (u: string, p: string) => {
        const data = await api.login(u, p);
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('auth_username', data.username);
        localStorage.setItem('auth_role', data.role);
        setUser({ username: data.username, role: data.role });
    };

    const logout = () => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_username');
        localStorage.removeItem('auth_role');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);

