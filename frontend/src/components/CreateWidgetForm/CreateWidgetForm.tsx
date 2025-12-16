import { useEffect, useState } from 'react';
import { Widget, Table } from '../../types';
import { viewApi } from '../../services/api';
import { SqlEditor } from '../SqlEditor';
import { format } from 'sql-formatter';

export interface CreateWidgetFormProps {
    onCreate: (w: Widget) => Promise<void>;
    onUpdate: (w: Widget) => Promise<void>;
    onCancelEdit: () => void;
    initialData: Widget | null;
}

export function CreateWidgetForm({ onCreate, onUpdate, onCancelEdit, initialData }: CreateWidgetFormProps) {
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [schema, setSchema] = useState<Table[]>([]);
    const [schemaLoading, setSchemaLoading] = useState(false);

    const [form, setForm] = useState<Widget>({
        id: '',
        type: 'stat',
        title: '',
        description: '',
        query: 'SELECT count() FROM default.events',
    });

    useEffect(() => {
        setSchemaLoading(true);
        viewApi.fetchSchema()
            .then((res) => setSchema(res.tables))
            .catch(console.error)
            .finally(() => setSchemaLoading(false));
    }, []);

    useEffect(() => {
        if (initialData) {
            setForm(initialData);
        } else {
            setForm({
                id: '',
                type: 'stat',
                title: '',
                description: '',
                query: 'SELECT count() FROM default.events',
            });
        }
    }, [initialData]);

    const handleChange = (field: keyof Widget, value: string | number) => {
        setForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleFormat = () => {
        try {
            const formatted = format(form.query, { language: 'postgresql' });
            handleChange('query', formatted);
        } catch (e) {
            console.error('Formatting failed:', e);
        }
    };

    const handleColumnClick = (colName: string) => {
        let textToInsert = colName;
        // Convert "group.field" to "group['field']" for ClickHouse Map access
        if (colName.includes('.')) {
            const [group, field] = colName.split('.', 2);
            textToInsert = `${group}['${field}']`;
        }

        setForm((prev) => {
            const separator = prev.query.endsWith(' ') || prev.query.endsWith('\n') || prev.query === '' ? '' : ' ';
            return { ...prev, query: prev.query + separator + textToInsert };
        });
    };

    const handleSubmit = async () => {
        setSaving(true);
        setError(null);
        try {
            if (!form.type || !form.title || !form.query) {
                throw new Error('Title and Query are required');
            }

            if (initialData) {
                await onUpdate(form);
            } else {
                const id = `w_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
                const payload = { ...form, id };
                await onCreate(payload);
                setForm({
                    id: '',
                    type: 'stat',
                    title: '',
                    description: '',
                    query: 'SELECT count() FROM default.events',
                });
            }
            onCancelEdit(); // Clear edit mode after success
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setSaving(false);
        }
    };

    // Helper to group columns for display
    const groupColumns = (columns: { name: string; type: string }[]) => {
        const root: { name: string; type: string }[] = [];
        const groups: Record<string, { name: string; type: string }[]> = {};

        columns.forEach((col) => {
            if (col.name.includes('.')) {
                const [group, name] = col.name.split('.', 2);
                if (!groups[group]) groups[group] = [];
                groups[group].push({ name, type: col.type });
            } else if (col.type.startsWith('Map(')) {
                // Treat top-level Maps as groups even if they have no expanded children yet
                if (!groups[col.name]) groups[col.name] = [];
            } else {
                root.push(col);
            }
        });
        return { root, groups };
    };

    return (
        <div className="space-y-3 rounded-md border border-border bg-surface-muted p-4">
            <h2 className="text-lg font-semibold">{initialData ? 'Edit widget' : 'Create widget'}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm text-muted sm:col-span-2">
                    Title
                    <input
                        className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
                        value={form.title}
                        onChange={(e) => handleChange('title', e.target.value)}
                        placeholder="Events"
                    />
                </label>
                <label className="text-sm text-muted">
                    Type
                    <select
                        className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
                        value={form.type}
                        onChange={(e) => handleChange('type', e.target.value)}
                    >
                        <option value="stat">Stat (Metric)</option>
                        <option value="bar">Bar Chart</option>
                        <option value="line">Line Chart</option>
                    </select>
                </label>
                <label className="text-sm text-muted">
                    Width
                    <select
                        className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
                        value={form.width || ''}
                        onChange={(e) => handleChange('width', e.target.value)}
                    >
                        <option value="">Default (1/3)</option>
                        <option value="1/3">1/3 Width</option>
                        <option value="1/2">1/2 Width</option>
                        <option value="2/3">2/3 Width</option>
                        <option value="full">Full Width</option>
                    </select>
                </label>
                <label className="text-sm text-muted">
                    Auto Refresh (sec)
                    <input
                        type="number"
                        min="0"
                        className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
                        value={form.refreshInterval || ''}
                        onChange={(e) => handleChange('refreshInterval', e.target.value ? parseInt(e.target.value) : 0)}
                        placeholder="0 (Disabled)"
                    />
                </label>
                <label className="text-sm text-muted sm:col-span-2">
                    Description (optional)
                    <input
                        className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
                        value={form.description || ''}
                        onChange={(e) => handleChange('description', e.target.value)}
                        placeholder="Count of events over last 24h"
                    />
                </label>
                <div className="text-sm text-muted sm:col-span-2">
                    <div className="mb-1 flex items-center justify-between">
                        <span className="block">Query (ClickHouse SQL)</span>
                        <button
                            type="button"
                            onClick={handleFormat}
                            className="text-xs text-primary hover:underline"
                            title="Format SQL query"
                        >
                            Format Query
                        </button>
                    </div>
                    <div className="mt-1">
                        <SqlEditor
                            value={form.query}
                            onChange={(value) => handleChange('query', value || '')}
                            height="200px"
                        />
                    </div>
                </div>

                <div className="sm:col-span-2">
                    <p className="mb-2 text-sm text-muted">Available Tables & Columns</p>
                    {schemaLoading ? (
                        <p className="text-xs text-muted">Loading schema...</p>
                    ) : (
                        <div className="grid gap-3 sm:grid-cols-2">
                            {schema.map((table) => {
                                const { root, groups } = groupColumns(table.columns);
                                // Hide root columns that are already displayed as groups
                                const visibleRoot = root.filter(col => !groups[col.name]);

                                return (
                                    <div key={table.name} className="rounded-lg border border-border bg-surface p-3 text-sm">
                                        <p className="mb-3 font-semibold text-primary">{table.name}</p>
                                        <div className="flex flex-col gap-2 text-muted">
                                            {visibleRoot.map((col) => (
                                                <div
                                                    key={col.name}
                                                    className="flex justify-between cursor-pointer hover:text-primary transition-colors"
                                                    onClick={() => handleColumnClick(col.name)}
                                                    title="Click to insert"
                                                >
                                                    <span className="font-mono text-text">{col.name}</span>
                                                    <span className="opacity-70">{col.type}</span>
                                                </div>
                                            ))}
                                            {Object.entries(groups).map(([groupName, cols]) => (
                                                <details key={groupName} className="group">
                                                    <summary className="flex cursor-pointer select-none items-center justify-between py-0.5 font-mono text-text">
                                                        <span>{groupName}</span>
                                                        <span className="border-b border-dashed border-text/40 text-xs opacity-50 hover:border-text/80">Map(String,String)</span>
                                                    </summary>
                                                    <div className="ml-1 mt-2 flex flex-col gap-2 border-l border-border pl-3">
                                                        {cols.length === 0 && (
                                                            <div className="text-[10px] text-muted italic px-1">Dynamic keys</div>
                                                        )}
                                                        {cols.map((col) => (
                                                            <div
                                                                key={col.name}
                                                                className="flex justify-between cursor-pointer hover:text-primary transition-colors"
                                                                onClick={() => handleColumnClick(`${groupName}.${col.name}`)}
                                                                title="Click to insert"
                                                            >
                                                                <span className="font-mono text-text">{col.name}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </details>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex gap-2">
                <button
                    className="rounded-lg border border-border-strong bg-primary/15 px-4 py-2 text-sm font-semibold text-text hover:border-border-strong disabled:opacity-50"
                    onClick={handleSubmit}
                    disabled={saving}
                >
                    {saving ? 'Saving…' : initialData ? 'Update widget' : 'Create widget'}
                </button>
                {initialData && (
                    <button
                        className="rounded-lg border border-border px-4 py-2 text-sm text-text hover:border-primary"
                        onClick={onCancelEdit}
                        disabled={saving}
                    >
                        Cancel
                    </button>
                )}
            </div>
        </div>
    );
}
