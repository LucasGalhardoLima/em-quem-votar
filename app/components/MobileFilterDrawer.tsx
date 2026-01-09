import { useRef, useEffect } from "react";
import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FilterSidebar } from "./FilterSidebar";

interface MobileFilterDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    query: string | null;
}

export function MobileFilterDrawer({ isOpen, onClose, query }: MobileFilterDrawerProps) {
    // Lock body scroll when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    // Use portal to render outside the main DOM hierarchy
    // Using document.body as container (Remix/RR7 usually hydrates full doc)
    const portalRoot = typeof document !== "undefined" ? document.body : null;

    if (!portalRoot) return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 lg:hidden"
                    />

                    {/* Drawer */}
                    <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 max-h-[85vh] flex flex-col shadow-2xl lg:hidden"
                        drag="y"
                        dragConstraints={{ top: 0 }}
                        dragElastic={0.05}
                        onDragEnd={(e, { offset, velocity }) => {
                            if (offset.y > 100 || velocity.y > 200) {
                                onClose();
                            }
                        }}
                    >
                        {/* Handle for drag indication */}
                        <div className="w-full flex justify-center pt-3 pb-1" onClick={onClose} >
                            <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
                        </div>

                        {/* Header */}
                        <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100">
                            <h2 className="text-xl font-bold text-gray-900">Filtros</h2>
                            <button onClick={onClose} className="p-2 -mr-2 text-gray-500 hover:bg-gray-100 rounded-full">
                                <X size={24} />
                            </button>
                        </div>

                        {/* Content - reuses FilterSidebar content but we need to ensure FilterSidebar fits nicely */}
                        {/* We might need to adjust FilterSidebar to be more flexible, but likely it works as it's just a list */}
                        <div className="overflow-y-auto px-6 py-6 flex-1 overscroll-contain pb-safe-area">
                            <FilterSidebar query={query} />
                        </div>

                        {/* Footer with Apply button if needed, but results are live so maybe just a Close button? 
                Actually the designs usually have a "Ver X resultados" button. 
                For now we keep it simple as live filtering.
            */}
                    </motion.div>
                </>
            )}
        </AnimatePresence>,
        portalRoot
    );
}
