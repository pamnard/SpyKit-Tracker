import React, { useState } from 'react';
import { LayoutHeader } from '../components/LayoutHeader';
import { Plus, User as UserIcon } from 'lucide-react';
import { useUsers, useCreateUser } from '../hooks/useUser';

export function UsersPage() {
    const { data: users, isLoading: loading, error: loadError } = useUsers();
    const createUserMutation = useCreateUser();

    const [showCreate, setShowCreate] = useState(false);
    const [newUser, setNewUser] = useState({ username: '', password: '', role: 'admin' });
    const [createError, setCreateError] = useState<string | null>(null);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreateError(null);
        try {
            await createUserMutation.mutateAsync(newUser);
            setNewUser({ username: '', password: '', role: 'admin' });
            setShowCreate(false);
        } catch (err) {
            setCreateError(err instanceof Error ? err.message : 'Failed to create user');
        }
    };

    return (
        <div>
            <LayoutHeader title="Users" baseUrl="/" hideEdit={true} />

            <div className="px-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-semibold text-text">Team Members</h2>
                    <button
                        onClick={() => setShowCreate(!showCreate)}
                        className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-contrast rounded-md text-sm font-medium hover:opacity-90"
                    >
                        <Plus size={16} />
                        Add User
                    </button>
                </div>

                {loadError && (
                    <div className="mb-4 p-3 bg-danger/10 border border-danger text-danger rounded-md text-sm">
                        {(loadError as Error).message}
                    </div>
                )}

                {showCreate && (
                    <div className="mb-8 p-4 bg-surface border border-border rounded-lg">
                        <h3 className="text-sm font-medium text-text mb-4">Create New User</h3>
                        {createError && (
                            <div className="mb-3 p-2 bg-danger/10 text-danger text-xs rounded">
                                {createError}
                            </div>
                        )}
                        <form onSubmit={handleCreate} className="space-y-4 max-w-md">
                            <div>
                                <label className="block text-xs text-muted mb-1">Username</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full bg-bg border border-border rounded p-2 text-sm text-text focus:border-primary outline-none"
                                    value={newUser.username}
                                    onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-muted mb-1">Password</label>
                                <input
                                    type="password"
                                    required
                                    className="w-full bg-bg border border-border rounded p-2 text-sm text-text focus:border-primary outline-none"
                                    value={newUser.password}
                                    onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-muted mb-1">Role</label>
                                <select
                                    className="w-full bg-bg border border-border rounded p-2 text-sm text-text focus:border-primary outline-none"
                                    value={newUser.role}
                                    onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                                >
                                    <option value="admin">Admin</option>
                                    <option value="viewer">Viewer</option>
                                </select>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="submit"
                                    disabled={createUserMutation.isPending}
                                    className="px-4 py-2 bg-primary text-primary-contrast rounded text-sm font-medium hover:opacity-90 disabled:opacity-50"
                                >
                                    {createUserMutation.isPending ? 'Creating...' : 'Create User'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowCreate(false)}
                                    className="px-4 py-2 border border-border text-text rounded text-sm font-medium hover:bg-surface-muted"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {loading ? (
                    <div className="text-muted text-sm">Loading users...</div>
                ) : (
                    <div className="grid gap-4">
                        {users?.map(u => (
                            <div key={u.username} className="flex items-center justify-between p-4 bg-surface border border-border rounded-lg">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-surface-muted flex items-center justify-center text-muted">
                                        <UserIcon size={20} />
                                    </div>
                                    <div>
                                        <p className="font-medium text-text">{u.username}</p>
                                        <p className="text-xs text-muted uppercase">{u.role}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
