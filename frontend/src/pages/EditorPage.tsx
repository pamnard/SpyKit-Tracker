import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useReport, useUpdateReport } from '../hooks/useReport';
import { useWidgets, useCreateWidget, useUpdateWidget, useDeleteWidget } from '../hooks/useWidget';
import { LayoutHeader } from '../components/LayoutHeader';
import { CreateWidgetForm } from '../components/CreateWidgetForm';
import { Widget } from '../types';

export function EditorPage() {
    const { id } = useParams<{ id: string }>();
    const { data: report, isLoading: loadingReport, error: reportError } = useReport(id || null);
    const updateReportMutation = useUpdateReport();

    // Use Widget hooks
    const { data: widgets, isLoading: loadingWidgets, error: widgetsError } = useWidgets();
    const createWidgetMutation = useCreateWidget();
    const updateWidgetMutation = useUpdateWidget();
    const deleteWidgetMutation = useDeleteWidget();

    const [title, setTitle] = useState('');
    const [editingWidget, setEditingWidget] = useState<Widget | null>(null);

    useEffect(() => {
        if (report) {
            setTitle(report.title);
        }
    }, [report]);

    if (!id) return null;

    if (loadingReport) {
        return <div className="p-4">Loading editor...</div>;
    }

    if (reportError) {
        return <div className="p-4 text-danger">Error: {(reportError as Error).message}</div>;
    }

    if (!report) return null;

    const currentWidgetIds = report.widgets.map((w) => w.id);

    const handleUpdateTitle = async () => {
        if (title !== report.title) {
            await updateReportMutation.mutateAsync({ id, title, widgets: currentWidgetIds });
        }
    };

    const handleAddWidget = async (widgetId: string) => {
        if (currentWidgetIds.includes(widgetId)) return;
        const newIds = [...currentWidgetIds, widgetId];
        await updateReportMutation.mutateAsync({ id, title, widgets: newIds });
    };

    const handleRemoveWidget = async (widgetId: string) => {
        const newIds = currentWidgetIds.filter((wid) => wid !== widgetId);
        await updateReportMutation.mutateAsync({ id, title, widgets: newIds });
    };

    const handleDeleteWidget = async (widgetId: string) => {
        if (confirm('Delete this widget?')) {
            await deleteWidgetMutation.mutateAsync(widgetId);
            // If it was in the report, update the report too
            if (currentWidgetIds.includes(widgetId)) {
                const newIds = currentWidgetIds.filter((wid) => wid !== widgetId);
                await updateReportMutation.mutateAsync({ id, title, widgets: newIds });
            }
        }
    };

    // Adapters for CreateWidgetForm which expects promises
    const handleCreateWidget = async (w: Widget) => {
        await createWidgetMutation.mutateAsync(w);
    };

    const handleUpdateWidget = async (w: Widget) => {
        await updateWidgetMutation.mutateAsync(w);
    };

    return (
        <div>
            <LayoutHeader
                title={`${title}`}
                baseUrl={`/report/${id}`}
            />

            <div className="space-y-6 px-6 pb-12">
                <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <label className="text-sm text-muted sm:col-span-2">
                            Title
                            <input
                                className="mt-1 w-full border-b border-border bg-surface px-3 py-2 text-sm text-text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                onBlur={handleUpdateTitle} // Auto-save on blur
                                placeholder="My report"
                            />
                        </label>
                    </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
                    <CreateWidgetForm
                        onCreate={handleCreateWidget}
                        onUpdate={handleUpdateWidget}
                        initialData={editingWidget}
                        onCancelEdit={() => setEditingWidget(null)}
                    />
                    <div className="rounded-md border border-border bg-surface-muted p-4">
                        <div className="space-y-6">
                            <div>
                                <h2 className="mb-2 text-lg font-semibold">Active Widgets</h2>
                                <div className="space-y-2">
                                    {report.widgets.map((w) => (
                                        <div
                                            key={w.id}
                                            className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2"
                                        >
                                            <p className="text-sm">{w.title}</p>
                                            <div className="flex gap-2">
                                                <button
                                                    className="rounded-lg border border-border px-3 py-1 text-xs hover:border-primary"
                                                    onClick={() => setEditingWidget(w)}
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    className="rounded-lg border border-danger px-3 py-1 text-xs text-danger hover:border-danger/80"
                                                    onClick={() => handleRemoveWidget(w.id)}
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {report.widgets.length === 0 && (
                                        <p className="text-sm text-subtle">No widgets in this report.</p>
                                    )}
                                </div>
                            </div>

                            <div className="border-t border-border pt-6">
                                <h2 className="mb-2 text-lg font-semibold">Available Widgets</h2>
                                {loadingWidgets && <p className="text-sm text-subtle">Loading…</p>}
                                {widgetsError && <p className="text-sm text-danger">Error: {(widgetsError as Error).message}</p>}

                                <div className="space-y-2">
                                    {widgets && widgets
                                        .filter((w) => !currentWidgetIds.includes(w.id))
                                        .map((w) => (
                                            <div
                                                key={w.id}
                                                className="flex items-start justify-between rounded-md border border-border bg-surface px-3 py-2"
                                            >
                                                <div>
                                                    <p className="text-sm font-semibold">{w.title}</p>
                                                    <p className="text-xs text-subtle">{w.id}</p>
                                                    <p className="text-xs text-subtle">{w.type}</p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        className="rounded-lg border border-border px-3 py-1 text-xs hover:border-primary"
                                                        onClick={() => setEditingWidget(w)}
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        className="rounded-lg border border-border px-3 py-1 text-xs hover:border-primary"
                                                        onClick={() => handleAddWidget(w.id)}
                                                    >
                                                        Add
                                                    </button>
                                                    <button
                                                        className="rounded-lg border border-danger px-3 py-1 text-xs text-danger hover:border-danger/80"
                                                        onClick={() => handleDeleteWidget(w.id)}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    {widgets && widgets.filter((w) => !currentWidgetIds.includes(w.id)).length === 0 && (
                                        <p className="text-sm text-subtle">No available widgets.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
