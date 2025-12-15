import { Widget } from '../../types';

export interface ReportWidgetsProps {
    widgets: Widget[];
    onRemoveFromReport: (id: string) => void;
}

export function ReportWidgets({ widgets, onRemoveFromReport }: ReportWidgetsProps) {
    return (
        <div className="rounded-md border border-border bg-surface-muted p-4">
            <h2 className="mb-2 text-lg font-semibold">Report Widgets</h2>
            <div className="space-y-2">
                {widgets.map((w) => (
                    <div
                        key={w.id}
                        className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2"
                    >
                        <p className="text-sm">{w.title}</p>
                        <button
                            className="rounded-lg border border-danger px-3 py-1 text-xs text-danger hover:border-danger/80"
                            onClick={() => onRemoveFromReport(w.id)}
                        >
                            Remove
                        </button>
                    </div>
                ))}
                {widgets.length === 0 && (
                    <p className="text-sm text-subtle">No widgets in this report.</p>
                )}
            </div>
        </div>
    );
}
