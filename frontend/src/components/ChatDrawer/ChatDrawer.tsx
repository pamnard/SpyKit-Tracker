import { X, ArrowBigRight, Brain, Pin, PinOff } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export interface ChatDrawerProps {
    isOpen: boolean;
    isPinned: boolean;
    onClose: () => void;
    onTogglePin: () => void;
};

export function ChatDrawer({ isOpen, isPinned, onClose, onTogglePin }: ChatDrawerProps) {
    const [messages, setMessages] = useState<Array<{ id: string; text: string; isUser: boolean }>>([
        { id: '1', text: 'Привет! Чем могу помочь?', isUser: false }
    ]);
    const [inputValue, setInputValue] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleSend = () => {
        if (!inputValue.trim()) return;

        const newMessage = {
            id: Date.now().toString(),
            text: inputValue,
            isUser: true
        };

        setMessages([...messages, newMessage]);
        setInputValue('');

        // Simulate AI response (placeholder)
        setTimeout(() => {
            const aiResponse = {
                id: (Date.now() + 1).toString(),
                text: 'Это заглушка ответа. Бекенд будет добавлен позже.',
                isUser: false
            };
            setMessages(prev => [...prev, aiResponse]);
        }, 500);
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Auto-resize textarea
    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
        }
    }, [inputValue]);

    const [width, setWidth] = useState(400);
    const [isResizing, setIsResizing] = useState(false);
    const sidebarRef = useRef<HTMLDivElement>(null);

    const startResizing = (mouseDownEvent: React.MouseEvent) => {
        mouseDownEvent.preventDefault();
        setIsResizing(true);
    };

    const stopResizing = () => {
        setIsResizing(false);
    };

    const resize = (mouseMoveEvent: MouseEvent) => {
        if (isResizing) {
            const newWidth = window.innerWidth - mouseMoveEvent.clientX;
            if (newWidth > 300 && newWidth < 800) {
                setWidth(newWidth);
            }
        }
    };

    useEffect(() => {
        window.addEventListener("mousemove", resize);
        window.addEventListener("mouseup", stopResizing);
        return () => {
            window.removeEventListener("mousemove", resize);
            window.removeEventListener("mouseup", stopResizing);
        };
    }, [isResizing]);

    if (!isOpen) return null;

    const drawerStyle = isPinned 
        ? { width: `${width}px` } 
        : { width: `${width}px`, maxWidth: '100%' };

    const drawerClasses = isPinned
        ? "border-l border-border bg-surface flex flex-col relative"
        : "fixed top-[15px] right-[15px] bottom-[15px] bg-surface border border-border rounded-md shadow-[0_20px_60px_rgba(0,0,0,0.4)] z-50 flex flex-col";

    return (
        <div 
            ref={sidebarRef}
            className={drawerClasses}
            style={drawerStyle}
        >
            <div
                className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-primary/50 transition z-10"
                onMouseDown={startResizing}
            />
            {/* Header */}
            <div className="flex items-center justify-between px-4 h-14 border-b border-border-strong flex-shrink-0">
                <h2 className="text-md font-semibold text-text flex items-center gap-2">
                    <Brain size={16} />
                    <span>ATHENE</span>
                </h2>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onTogglePin}
                        className="p-1.5 rounded-lg hover:bg-surface-muted text-muted hover:text-text transition"
                        aria-label={isPinned ? "Unpin" : "Pin"}
                    >
                        {isPinned ? <PinOff size={20} /> : <Pin size={20} />}
                    </button>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-surface-muted text-muted hover:text-text transition"
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 text-sm">
                    {messages.map((message) => (
                        <div
                            key={message.id}
                            className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                                    message.isUser
                                        ? 'bg-primary text-white'
                                        : 'bg-surface-muted text-text border border-border'
                                }`}
                            >
                                <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Input */}
                <div className="p-4 border-t border-border">
                    <div className="px-2 py-2 rounded-md border border-border bg-surface-strong">
                        <textarea
                            ref={textareaRef}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyPress}
                            placeholder="Введите сообщение..."
                            rows={1}
                            className="w-full px-2 py-2 text-sm bg-transparent text-text placeholder:text-muted focus:outline-none resize-none overflow-hidden min-h-[44px] max-h-[200px]"
                        />
                        <div className="flex justify-end">
                            <button
                                onClick={handleSend}
                                disabled={!inputValue.trim()}
                                className="w-6 h-6 rounded-md bg-primary text-primary-contrast hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center"
                                aria-label="Send message"
                            >
                                <ArrowBigRight size={14} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
    );
}

