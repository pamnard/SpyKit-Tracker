import { Activity } from 'lucide-react';

export interface LogoProps {
    className?: string;
    iconSize?: number;
    textClassName?: string;
}

export function Logo({ className = '', iconSize = 16, textClassName = '' }: LogoProps) {
    return (
        <span className={`inline-flex items-center gap-2 ${className}`}>
            <Activity size={iconSize} aria-hidden className="logo-icon-shift" />
            <span className={`uppercase tracking-[0.12em] ${textClassName}`}>Athene</span>
        </span>
    );
}
