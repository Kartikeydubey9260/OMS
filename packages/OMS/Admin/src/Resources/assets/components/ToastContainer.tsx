import React, { useState, useEffect } from "react";

export interface ToastMessage {
    id: string;
    type: "success" | "error" | "info";
    text: string;
}

let toastsList: ToastMessage[] = [];
const listeners = new Set<(toasts: ToastMessage[]) => void>();

const notify = () => {
    listeners.forEach((l) => l([...toastsList]));
};

export const toast = {
    show: (text: string, type: "success" | "error" | "info" = "success") => {
        const id = Math.random().toString(36).substring(2, 9);
        const item: ToastMessage = { id, type, text };
        toastsList.push(item);
        notify();
        setTimeout(() => {
            toastsList = toastsList.filter((t) => t.id !== id);
            notify();
        }, 5000);
    },
    success: (text: string) => toast.show(text, "success"),
    error: (text: string) => toast.show(text, "error"),
    info: (text: string) => toast.show(text, "info"),
};

export const ToastContainer: React.FC = () => {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    useEffect(() => {
        listeners.add(setToasts);
        return () => {
            listeners.delete(setToasts);
        };
    }, []);

    if (toasts.length === 0) return null;

    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
            {toasts.map((t) => (
                <div
                    key={t.id}
                    data-testid="toast"
                    role={t.type === "error" ? "alert" : "status"}
                    className={`p-4 rounded-md shadow-lg text-sm font-medium flex items-center justify-between border ${
                        t.type === "error"
                            ? "bg-red-50 text-red-800 border-red-200"
                            : t.type === "info"
                            ? "bg-blue-50 text-blue-800 border-blue-200"
                            : "bg-green-50 text-green-800 border-green-200"
                    }`}
                >
                    <span>{t.text}</span>
                    <button
                        type="button"
                        onClick={() => {
                            toastsList = toastsList.filter((item) => item.id !== t.id);
                            notify();
                        }}
                        className="ml-3 text-gray-500 hover:text-gray-700 focus:outline-none"
                    >
                        ×
                    </button>
                </div>
            ))}
        </div>
    );
};
