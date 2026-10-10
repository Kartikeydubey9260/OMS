import React, { useEffect, useRef } from "react";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    triggerRef?: React.RefObject<HTMLElement | null>;
}

export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    triggerRef,
}) => {
    const previousFocusRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (isOpen) {
            previousFocusRef.current = (triggerRef?.current || document.activeElement) as HTMLElement;
            const handleKeyDown = (e: KeyboardEvent) => {
                if (e.key === "Escape") {
                    e.preventDefault();
                    onClose();
                }
            };
            window.addEventListener("keydown", handleKeyDown);
            return () => {
                window.removeEventListener("keydown", handleKeyDown);
            };
        } else if (previousFocusRef.current) {
            // Restore focus on close
            previousFocusRef.current.focus();
            previousFocusRef.current = null;
        }
    }, [isOpen, onClose, triggerRef]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
        >
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 relative">
                <div className="flex justify-between items-center mb-4">
                    <h3 id="modal-title" className="text-lg font-bold text-gray-900">
                        {title}
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 focus:outline-none"
                    >
                        ✕
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
};
