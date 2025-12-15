import React from 'react';
import { NavLink } from 'react-router-dom';
import { Database } from 'lucide-react';
import { ReportMeta, View } from '../types';

/**
 * Configuration for different sidebar item types
 */
interface SidebarItemTypeConfig {
    urlPrefix: string;
    getKey: (item: any) => string;
    getDisplayText: (item: any) => string;
    getTitle?: (item: any) => string;
    icon?: React.ReactNode;
}

/**
 * Universal render function factory for sidebar navigation items
 * Returns a render function configured for specific item types
 */
export function createSidebarItemRenderer<T>(config: SidebarItemTypeConfig) {
    return (item: T): React.ReactNode => {
        const key = config.getKey(item);
        return (
            <NavLink
                key={key}
                to={`${config.urlPrefix}/${key}`}
                className={({ isActive }) =>
                    `flex items-center gap-2 py-2 pl-4 -ml-4 border-l-2 text-sm transition-colors ${
                        isActive
                            ? 'border-text text-text font-medium'
                            : 'border-transparent text-muted hover:text-text'
                    }`
                }
                title={config.getTitle?.(item)}
            >
                {config.icon}
                <span className="truncate">{config.getDisplayText(item)}</span>
            </NavLink>
        );
    };
}

/**
 * Pre-configured render function for Reports
 */
export const renderReportItem = createSidebarItemRenderer<ReportMeta>({
    urlPrefix: '/report',
    getKey: (report) => report.id,
    getDisplayText: (report) => report.title || report.id,
});

/**
 * Render function for Views
 */
export const renderViewItem = createSidebarItemRenderer<View>({
    urlPrefix: '/views',
    getKey: (view) => view.id,
    getDisplayText: (view) => view.name,
    icon: <Database size={14} className="opacity-70" />, 
});
