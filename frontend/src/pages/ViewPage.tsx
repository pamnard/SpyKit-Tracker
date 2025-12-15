import { useParams, useNavigate, Link } from 'react-router-dom';
import { LayoutHeader } from '../components/LayoutHeader';
import { SqlEditor } from '../components/SqlEditor';
import { Pencil } from 'lucide-react';
import { useView, useDeleteView } from '../hooks/useView';

export function ViewPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const { data: definition, isLoading, error } = useView(id);
    const deleteViewMutation = useDeleteView();

    const handleDelete = async () => {
        if (!id || !definition || !confirm(`Are you sure you want to delete view "${definition.name}"? This cannot be undone.`)) return;

        try {
            await deleteViewMutation.mutateAsync(id);
            navigate('/settings');
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to delete view');
        }
    };

    if (isLoading) return <div className="p-6">Loading view...</div>;
    if (error) return <div className="p-6 text-danger">Error: {(error as Error).message}</div>;
    if (!definition) return <div className="p-6">View not found</div>;

    return (
        <div>
            <LayoutHeader
                title={`View: ${definition.name}`}
                baseUrl="/settings"
                extraActions={
                    <Link
                        to={`/views/${id}/edit`}
                        className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-contrast hover:bg-primary/90"
                    >
                        <Pencil size={14} />
                        Edit
                    </Link>
                }
            />

            <div className="p-6 max-w-4xl mx-auto space-y-6">
                <div className="bg-surface p-6 rounded-lg border border-border space-y-4">
                    <div>
                        <h3 className="text-sm font-medium text-muted mb-2">Definition (Read-only)</h3>
                        <SqlEditor
                            value={definition.query}
                            onChange={() => { }} // Read-only
                            height="300px"
                            className="border border-border opacity-80"
                        />
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t border-border">
                        <div className="text-xs text-subtle">
                            To modify a view, you must drop and recreate it.
                        </div>
                        <button
                            onClick={handleDelete}
                            disabled={deleteViewMutation.isPending}
                            className="px-4 py-2 text-sm font-medium bg-danger text-white rounded-md hover:bg-danger/90 disabled:opacity-50"
                        >
                            {deleteViewMutation.isPending ? 'Deleting...' : 'Delete View'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
