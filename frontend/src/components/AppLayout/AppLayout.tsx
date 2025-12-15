import { Outlet } from 'react-router-dom';
import { Sidebar } from '../Sidebar';
import { useReports } from '../../hooks/useReport';
import { useViews } from '../../hooks/useView';
import { ChatDrawer } from '../ChatDrawer';
import { useChatDrawer } from '../../context/ChatDrawerContext';

export function AppLayout() {
    const { data: reports, error: reportsError } = useReports();
    const { data: views, error: viewsError } = useViews();
    const { isOpen, isPinned, close, togglePin } = useChatDrawer();

    const error = reportsError
        ? (reportsError as Error).message
        : (viewsError ? (viewsError as Error).message : null);

    return (
        <div className="h-screen bg-bg text-text flex overflow-hidden">
            <Sidebar
                reports={reports || []}
                views={views || []}
                error={error}
            />
            <div className="flex-1 flex flex-col min-w-0 overflow-auto relative">
                <Outlet />
            </div>
            {isPinned && isOpen && (
                <ChatDrawer isOpen={isOpen} isPinned={isPinned} onClose={close} onTogglePin={togglePin} />
            )}
            {!isPinned && isOpen && (
                <ChatDrawer isOpen={isOpen} isPinned={isPinned} onClose={close} onTogglePin={togglePin} />
            )}
        </div>
    );
}
