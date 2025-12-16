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
    const [engine, setEngine] = useState('SummingMergeTree');
    const [orderBy, setOrderBy] = useState('(event_date, event_name)');
    const [error, setError] = useState<string | null>(null);

    const createViewMutation = useCreateView();

    const handleCreate = async () => {
        if (!name || !query) return;
        if (isMaterialized && (!engine || !orderBy)) {
            setError('Engine and Order By are required for Materialized Views');
            return;
        }

        setError(null);
        try {
            const result = await createViewMutation.mutateAsync({ 
                name, 
                query, 
                isMaterialized,
                engine: isMaterialized ? engine : undefined,
                orderBy: isMaterialized ? orderBy : undefined
            });
            // Redirect to the newly created view page
            navigate(`/views/${result.id}`);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unknown error');
        }
    };

    return (
        <div>
            <LayoutHeader title="Create Database View" baseUrl="/settings" />

            <div className="p-6 w-full mx-auto space-y-6">
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
                        <label htmlFor="materialized" className="text-sm text-text">Materialized View (creates physical table)</label>
                    </div>

                    {isMaterialized && (
                        <div className="grid grid-cols-2 gap-4 p-4 bg-surface-muted rounded-md border border-border/50">
                            <div>
                                <label className="block text-sm font-medium text-muted mb-1">Table Engine</label>
                                <select
                                    value={engine}
                                    onChange={(e) => setEngine(e.target.value)}
                                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text"
                                >
                                    <option value="SummingMergeTree">SummingMergeTree (Recommended for stats)</option>
                                    <option value="AggregatingMergeTree">AggregatingMergeTree (Advanced)</option>
                                    <option value="MergeTree">MergeTree (Standard)</option>
                                </select>
                                <p className="text-xs text-subtle mt-1">Determines how data is aggregated on disk.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-muted mb-1">Order By Key</label>
                                <input
                                    type="text"
                                    value={orderBy}
                                    onChange={(e) => setOrderBy(e.target.value)}
                                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text"
                                    placeholder="(col1, col2)"
                                />
                                <p className="text-xs text-subtle mt-1">Columns to sort and aggregate by. Tuple format required.</p>
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-muted mb-1">Select Query</label>
                        <SqlEditor
                            value={query}
                            onChange={(val) => setQuery(val || '')}
                            height="300px"
                            className="border border-border"
                        />
                        <p className="text-xs text-subtle mt-1">
                            For Materialized Views, use <code>SELECT ... FROM ...</code> syntax. 
                            Aggregates will be calculated incrementally on insert.
                        </p>
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
