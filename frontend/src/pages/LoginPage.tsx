import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Logo } from '../components/Logo';

export const LoginPage: React.FC = () => {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [pass, setPass] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            await login(username, pass);
            navigate('/');
        } catch (err: any) {
            console.error(err);
            setError('Login failed. Please check your credentials.');
        }
    };

    return (
        <div className="flex h-screen items-center justify-center bg-bg text-text">
            <div className="w-full max-w-md p-8 bg-surface border border-border rounded-lg shadow-lg">
                <div className="flex justify-center mb-6 text-primary">
                    <Logo iconSize={32} textClassName="text-2xl" />
                </div>
                {error && <div className="mb-4 text-danger text-sm">{error}</div>}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm mb-1 text-muted">Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full bg-bg border border-border rounded p-2 focus:border-primary outline-none text-text transition-colors"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm mb-1 text-muted">Password</label>
                        <input
                            type="password"
                            value={pass}
                            onChange={(e) => setPass(e.target.value)}
                            className="w-full bg-bg border border-border rounded p-2 focus:border-primary outline-none text-text transition-colors"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full bg-primary text-primary-contrast font-bold py-2 rounded hover:opacity-90 transition-opacity cursor-pointer"
                    >
                        Войти
                    </button>
                </form>
            </div>
        </div>
    );
};
