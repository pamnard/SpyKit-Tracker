import { Widget } from '../../types';
import { WidgetCard } from '../WidgetCard';

export interface ReportViewProps {
    widgets: Widget[];
    statusLabel: string;
    title: string;
}

// Helper to determine col-span class based on width
function getColSpan(width?: string) {
    switch (width) {
        case '1/3': return 'xl:col-span-2';
        case '1/2': return 'xl:col-span-3';
        case '2/3': return 'xl:col-span-4';
        case 'full': return 'xl:col-span-6';
        default: return 'xl:col-span-2'; // Default to 1/3
    }
}

export function ReportView({ widgets, statusLabel, title }: ReportViewProps) {
    return (
        <main className="space-y-6">
            <section className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-6">
                {widgets.map((w) => (
                    <WidgetCard key={w.id} widget={w} className={getColSpan(w.width)} />
                ))}
                {widgets.length === 0 ? (
                    <article className="rounded-md border border-dashed border-border bg-surface-muted p-4 text-sm text-subtle col-span-full">
                        Нет виджетов. Добавьте через Edit.
                    </article>
                ) : null}
            </section>
        </main>
    );
}
