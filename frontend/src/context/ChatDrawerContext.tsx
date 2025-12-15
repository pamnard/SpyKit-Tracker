import { createContext, useContext, useState, ReactNode } from 'react';

type ChatDrawerContextType = {
    isOpen: boolean;
    isPinned: boolean;
    open: () => void;
    close: () => void;
    toggle: () => void;
    togglePin: () => void;
};

const ChatDrawerContext = createContext<ChatDrawerContextType | undefined>(undefined);

export function ChatDrawerProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isPinned, setIsPinned] = useState(false);

    const open = () => setIsOpen(true);
    const close = () => {
        setIsOpen(false);
        setIsPinned(false);
    };
    const toggle = () => setIsOpen(prev => !prev);
    const togglePin = () => setIsPinned(prev => !prev);

    return (
        <ChatDrawerContext.Provider value={{ isOpen, isPinned, open, close, toggle, togglePin }}>
            {children}
        </ChatDrawerContext.Provider>
    );
}

export function useChatDrawer() {
    const context = useContext(ChatDrawerContext);
    if (context === undefined) {
        throw new Error('useChatDrawer must be used within ChatDrawerProvider');
    }
    return context;
}

