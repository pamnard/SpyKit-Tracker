import { useParams } from 'react-router-dom';
import { useReport } from '../hooks/useReport';
import { ReportView } from '../components/ReportView';
import { LayoutHeader } from '../components/LayoutHeader';

export function ReportPage() {
    const { id } = useParams<{ id: string }>();
    const { data: report, isLoading, error } = useReport(id || null);

    if (!id) return null;

    if (isLoading) {
        return <div className="p-4">Loading report...</div>;
    }

    if (error) {
        return <div className="p-4 text-danger">Error: {(error as Error).message}</div>;
    }

    if (!report) return null;

    return (
        <div>
            <LayoutHeader
                title={report.title || 'Untitled Report'}
                baseUrl={`/report/${id}`}
            />
            <div className="px-4 pb-12">
                <ReportView
                    widgets={report.widgets}
                    statusLabel="Live"
                    title={report.title}
                />
            </div>
        </div>
    );
}
