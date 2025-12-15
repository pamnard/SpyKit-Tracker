import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateReport } from '../hooks/useReport';

export function NewReportPage() {
    const navigate = useNavigate();
    const createReportMutation = useCreateReport();

    const [title, setTitle] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        try {
            const res = await createReportMutation.mutateAsync({ title });
            navigate(`/report/${res.id}/edit`);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    };

    return (
        <div>
            <header className="flex items-center justify-between border-b border-border h-14 px-6 mb-6">
                <div>
                    <h1 className="text-base font-semibold">New Report</h1>
                </div>
            </header>

            <div className="px-6 pb-12">
                <form onSubmit={handleCreate} className="max-w-md rounded-md border border-border bg-surface-muted p-6 space-y-4">
                    <label className="block text-sm text-muted">
                        Report Title
                        <input
                            className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="My Awesome Report"
                            required
                        />
                    </label>

                    {error && <p className="text-sm text-danger">{error}</p>}
                    {createReportMutation.isError && <p className="text-sm text-danger">{(createReportMutation.error as Error).message}</p>}

                    <button
                        type="submit"
                        disabled={createReportMutation.isPending}
                        className="w-full rounded-lg border border-border-strong bg-primary/15 px-4 py-2 text-sm font-semibold text-text hover:border-primary disabled:opacity-50"
                    >
                        {createReportMutation.isPending ? 'Creating...' : 'Create Report'}
                    </button>
                </form>
            </div>
        </div>
    );
}
