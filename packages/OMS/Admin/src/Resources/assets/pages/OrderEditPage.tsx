import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, ApiClientError } from "../api/client";
import { toast } from "../components/ToastContainer";

export const OrderEditPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [priority, setPriority] = useState<string>("normal");
    const [version, setVersion] = useState<number>(1);
    const [orderNumber, setOrderNumber] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!id) return;
        setLoading(true);
        api.get(`/orders/${id}`)
            .then((res) => {
                const o = res.data;
                setPriority(o.priority || "normal");
                setVersion(o.version || 1);
                setOrderNumber(o.order_number || "");
            })
            .catch((err) => {
                toast.error(err?.message || "Failed to load order.");
            })
            .finally(() => setLoading(false));
    }, [id]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.put(`/orders/${id}`, {
                priority,
                version,
            });
            toast.success("Order updated successfully.");
            navigate(`/orders/${id}`);
        } catch (err: unknown) {
            if (err instanceof ApiClientError && (err.status === 409 || err.code === "OPTIMISTIC_LOCK_CONFLICT")) {
                toast.error(err.message || "Order has been modified by another user. Please reload.");
            } else {
                toast.error(err instanceof Error ? err.message : "Failed to update order.");
            }
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="max-w-xl mx-auto px-4 py-8">
                <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
            </div>
        );
    }

    return (
        <div className="max-w-xl mx-auto px-4 py-8 space-y-6 overflow-x-hidden">
            <h1 data-testid="page-title" className="text-3xl font-extrabold text-gray-900 tracking-tight">
                Edit Order {orderNumber}
            </h1>

            <form onSubmit={handleSave} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
                <div>
                    <label htmlFor="edit-priority" className="block text-sm font-semibold text-gray-700 mb-1">
                        Order Priority
                    </label>
                    <select
                        id="edit-priority"
                        data-testid="edit-priority"
                        value={priority}
                        onChange={(e) => setPriority(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[38px] text-gray-900"
                    >
                        <option value="low">Low</option>
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                    </select>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                    <button
                        type="button"
                        onClick={() => navigate(`/orders/${id}`)}
                        className="px-4 py-2 border border-gray-300 rounded-md text-sm font-semibold text-gray-700 hover:bg-gray-50 min-h-[38px]"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        data-testid="edit-save"
                        disabled={saving}
                        className="px-5 py-2 bg-indigo-600 text-white rounded-md text-sm font-semibold hover:bg-indigo-700 min-h-[38px] disabled:opacity-50"
                    >
                        {saving ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            </form>
        </div>
    );
};
