import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LayoutHeader } from '../components/LayoutHeader';
import { SqlEditor } from '../components/SqlEditor';
import { useView, useUpdateView } from '../hooks/useView';

export function EditViewPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    // Fetch data
    const { data: viewData, isLoading: loadingView } = useView(id);
    const updateViewMutation = useUpdateView();
    
    const [name, setName] = useState('');
    const [query, setQuery] = useState('');
    const [isMaterialized, setIsMaterialized] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Sync state when data is loaded
    useEffect(() => {
        if (viewData) {
            setName(viewData.name);
            
            // Extract SELECT query from DDL
            // DDL format: CREATE [MATERIALIZED] VIEW [db.]name [TO ...] AS SELECT ...
            // Simple regex to find "AS" (case insensitive) followed by query
            const match = viewData.query.match(/AS\s+([\s\S]+)$/i);
            const selectQuery = match ? match[1].trim() : viewData.query;
            setQuery(selectQuery);
            
            setIsMaterialized(viewData.query.toUpperCase().includes('MATERIALIZED VIEW'));
        }
    }, [viewData]);

    const handleSave = async () => {
        if (!id || !name || !query) return;

        setError(null);
        try {
            await updateViewMutation.mutateAsync({ id, name, query, isMaterialized });
            navigate(`/views/${id}`);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unknown error');
        }
    };

    if (loadingView) return <div className="p-6">Loading...</div>;

    return (
        <div>
            <LayoutHeader title={`Edit View: ${name}`} baseUrl={`/views/${id}`} />

            <div className="p-6 max-w-4xl mx-auto space-y-6">
                <div className="grid gap-4 bg-surface p-6 rounded-lg border border-border">
                    <div className="bg-surface-muted p-4 rounded-md border border-amber-500/30 text-amber-500 text-sm mb-2">
                        <strong>Warning:</strong> Editing a view will DROP and RECREATE it. 
                        If this is a Materialized View, stored data in the inner table might be lost depending on configuration.
                    </div>

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

                    {updateViewMutation.isError && (
                        <div className="p-3 bg-danger/10 text-danger text-sm rounded-md border border-danger/20">
                            Error: {(updateViewMutation.error as Error).message}
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            onClick={() => navigate(`/views/${id}`)}
                            className="px-4 py-2 text-sm font-medium text-muted hover:text-text transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={updateViewMutation.isPending || !name}
                            className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50"
                        >
                            {updateViewMutation.isPending ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
