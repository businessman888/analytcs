'use client';

import { useEffect, useState, createContext, useContext, type ReactNode } from 'react';
import { X, AlertTriangle, CheckCircle, Info, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';

// Toast types
type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
    id: string;
    type: ToastType;
    title: string;
    message?: string;
    duration?: number;
}

interface ToastContextType {
    addToast: (toast: Omit<Toast, 'id'>) => void;
    removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within ToastProvider');
    }
    return context;
}

const icons: Record<ToastType, typeof Info> = {
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
};

const styles: Record<ToastType, string> = {
    success: 'bg-green-500/10 border-green-500/20 text-green-400',
    error: 'bg-red-500/10 border-red-500/20 text-red-400',
    warning: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
    info: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
    const Icon = icons[toast.type];

    useEffect(() => {
        const timer = setTimeout(onRemove, toast.duration || 5000);
        return () => clearTimeout(timer);
    }, [onRemove, toast.duration]);

    return (
        <div
            className={clsx(
                'flex items-start gap-3 px-4 py-3 rounded-xl border backdrop-blur-sm',
                'animate-in slide-in-from-right-5 fade-in duration-300',
                styles[toast.type]
            )}
        >
            <Icon size={18} className="mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{toast.title}</p>
                {toast.message && (
                    <p className="text-xs opacity-80 mt-0.5">{toast.message}</p>
                )}
            </div>
            <button
                onClick={onRemove}
                className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            >
                <X size={16} />
            </button>
        </div>
    );
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = (toast: Omit<Toast, 'id'>) => {
        const id = Math.random().toString(36).slice(2);
        setToasts(prev => [...prev, { ...toast, id }]);
    };

    const removeToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    return (
        <ToastContext.Provider value={{ addToast, removeToast }}>
            {children}
            <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
                {toasts.map(toast => (
                    <div key={toast.id} className="pointer-events-auto">
                        <ToastItem toast={toast} onRemove={() => removeToast(toast.id)} />
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}
