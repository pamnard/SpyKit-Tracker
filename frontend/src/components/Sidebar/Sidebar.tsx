import { ReportMeta, View } from '../../types';
import { Logo } from '../Logo';
import { UserMenu } from '../UserMenu';
import { SidebarSection } from '../SidebarSection';
import { renderReportItem, renderViewItem } from './renderFunctions';

export interface SidebarProps {
    reports: ReportMeta[];
    views: View[];
    error: string | null;
}

export function Sidebar({ reports, views, error }: SidebarProps) {
    return (
        <aside className="w-64 shrink-0 border-r border-border bg-surface-muted flex flex-col h-full">
            <div className="px-4 border-b border-border h-14 flex items-center mb-4 shrink-0">
                <Logo className="text-text" textClassName="text-muted text-md font-semibold" iconSize={14} />
            </div>

            <div className="px-4 space-y-6 flex-1 overflow-y-auto min-h-0">
                {/* Reports Section */}
                <SidebarSection
                    title="Reports"
                    items={reports}
                    newButtonLink="/new"
                    renderItem={renderReportItem}
                    showEmptyState={false}
                />

                {/* Views Section */}
                <SidebarSection
                    title="Views"
                    items={views}
                    newButtonLink="/views/new"
                    renderItem={renderViewItem}
                    emptyStateMessage="No views"
                    showEmptyState={true}
                />
            </div>

            <div className="p-4 border-t border-border mt-auto shrink-0">
                {error && <p className="text-xs text-danger mb-2">{error}</p>}
                <UserMenu />
            </div>
        </aside>
    );
}
