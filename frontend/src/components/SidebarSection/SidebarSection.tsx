import React from 'react';
import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

interface SidebarSectionProps<T> {
    title: string;
    items: T[];
    newButtonLink: string;
    renderItem: (item: T, index: number) => React.ReactNode;
    emptyStateMessage?: string;
    showEmptyState?: boolean;
}

export function SidebarSection<T>({
    title,
    items,
    newButtonLink,
    renderItem,
    emptyStateMessage,
    showEmptyState = false,
}: SidebarSectionProps<T>) {
    return (
        <div>
            <div className="flex items-center justify-between text-sm mb-2">
                <p className="text-muted font-medium">{title}</p>
                <Link
                    to={newButtonLink}
                    className="rounded-md border border-border-strong px-2 py-1 font-medium text-primary hover:border-primary flex items-center gap-1 transition-colors text-xs"
                >
                    <Plus size={12} />
                    New
                </Link>
            </div>
            <div className="space-y-1">
                {items.map((item, index) => renderItem(item, index))}
                {items.length === 0 && showEmptyState && emptyStateMessage && (
                    <p className="text-xs text-subtle italic">{emptyStateMessage}</p>
                )}
            </div>
        </div>
    );
}