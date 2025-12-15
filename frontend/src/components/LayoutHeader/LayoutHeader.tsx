import { NavLink, useLocation } from 'react-router-dom';
import { Brain } from 'lucide-react';
import { useChatDrawer } from '../../context/ChatDrawerContext';
import React from 'react';

export interface LayoutHeaderProps {
    title: string;
    baseUrl: string; // e.g. /report/123
    hideEdit?: boolean;
    extraActions?: React.ReactNode;
}

export function LayoutHeader({ title, baseUrl, hideEdit, extraActions }: LayoutHeaderProps) {
    const location = useLocation();
    const isEditMode = location.pathname === `${baseUrl}/edit`;
    const { open, isOpen } = useChatDrawer();

    return (
        <header className="flex items-center justify-between border-b border-border h-14 mb-6 tracking-tight px-6">
            <div className="flex items-center gap-3">
                <h1 className="text-sm font-semibold text-text uppercase">{title}</h1>
                {!hideEdit && !extraActions && (
                    <NavLink
                        to={isEditMode ? baseUrl : `${baseUrl}/edit`}
                        className="ml-4 rounded-md border px-3 py-1.5 transition font-medium border-border bg-transparent text-sm text-muted hover:border-border-strong"
                    >
                        {isEditMode ? 'Save' : 'Edit'}
                    </NavLink>
                )}
                {extraActions}
            </div>
            {!isOpen && (
                <button
                    onClick={open}
                    className="p-2 rounded-lg hover:bg-surface-muted text-muted hover:text-text transition"
                    aria-label="Open AI Assistant"
                >
                    <Brain size={20} />
                </button>
            )}
        </header>
    );
}
