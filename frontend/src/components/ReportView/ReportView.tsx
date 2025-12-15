import { Widget } from '../../types';
import { WidgetCard } from '../WidgetCard';

export interface ReportViewProps {
    widgets: Widget[];
    statusLabel: string;
    title: string;
}

export function ReportView({ widgets, statusLabel, title }: ReportViewProps) {
    return (
        <main className="space-y-6">
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {widgets.map((w) => (
                    <WidgetCard key={w.id} widget={w} />
                ))}
                {widgets.length === 0 ? (
                    <article className="rounded-md border border-dashed border-border bg-surface-muted p-4 text-sm text-subtle">
                        Нет виджетов. Добавьте через Edit.
                    </article>
                ) : null}
            </section>

            <section className="rounded-md border border-border bg-surface-muted p-5">
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-[0.12em] text-subtle">Charts</p>
                        <h2 className="text-xl font-semibold">Event stream</h2>
                    </div>
                    <div className="flex gap-2">
                        {['24h', '7d', '30d'].map((label, idx) => (
                            <button
                                key={label}
                                className={`rounded-lg border px-3 py-2 text-sm transition ${idx === 0
                                    ? 'border-border-strong bg-primary/15 text-text'
                                    : 'border-border bg-surface text-text hover:border-primary'
                                    }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="rounded-md border border-dashed border-border bg-surface-strong p-5 text-sm text-text">
                    <p>{statusLabel}</p>
                    <p className="text-xs text-subtle">Data source: /api/reports</p>
                </div>
            </section>
        </main>
    );
}
