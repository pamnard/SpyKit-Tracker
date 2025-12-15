import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutHeader } from '../components/LayoutHeader';
import { SqlEditor } from '../components/SqlEditor';
import { useCreateView } from '../hooks/useView';

export function CreateViewPage() {
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [query, setQuery] = useState('SELECT * FROM default.events');
    const [isMaterialized, setIsMaterialized] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const createViewMutation = useCreateView();

    const handleCreate = async () => {
        if (!name || !query) return;

        setError(null);
        try {
            await createViewMutation.mutateAsync({ name, query, isMaterialized });
            navigate('/settings');
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unknown error');
        }
    };

    return (
        <div>
            <LayoutHeader title="Create Database View" baseUrl="/settings" />

            <div className="p-6 max-w-4xl mx-auto space-y-6">
                <div className="grid gap-4 bg-surface p-6 rounded-lg border border-border">
                    <div>
                        <label className="block text-sm font-medium text-muted mb-1">View Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text"
                            placeholder="e.g. daily_active_users"
                        />
                        <p className="text-xs text-subtle mt-1">Only alphanumeric characters and underscores.</p>
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="materialized"
                            checked={isMaterialized}
                            onChange={(e) => setIsMaterialized(e.target.checked)}
                            className="rounded border-border bg-surface text-primary"
                        />
                        <label htmlFor="materialized" className="text-sm text-text">Materialized View</label>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-muted mb-1">Select Query</label>
                        <SqlEditor
                            value={query}
                            onChange={(val) => setQuery(val || '')}
                            height="300px"
                            className="border border-border"
                        />
                    </div>

                    {error && (
                        <div className="p-3 bg-danger/10 text-danger text-sm rounded-md border border-danger/20">
                            Error: {error}
                        </div>
                    )}
                    
                    {createViewMutation.isError && (
                        <div className="p-3 bg-danger/10 text-danger text-sm rounded-md border border-danger/20">
                             Error: {(createViewMutation.error as Error).message}
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            onClick={() => navigate('/settings')}
                            className="px-4 py-2 text-sm font-medium text-muted hover:text-text transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleCreate}
                            disabled={createViewMutation.isPending || !name}
                            className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50"
                        >
                            {createViewMutation.isPending ? 'Creating...' : 'Create View'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
