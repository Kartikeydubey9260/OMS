import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../state/auth";
import { api, ApiClientError } from "../api/client";
import { formatMoney, capitalize } from "../utils/formatters";
import { Modal } from "../components/Modal";
import { toast } from "../components/ToastContainer";

interface OrderDetail {
    id: number;
    order_number: string;
    customer_id: number;
    customer: { id: number; name: string; email: string; phone?: string };
    total: number | string;
    subtotal: number | string;
    tax_amount: number | string;
    discount_amount: number | string;
    status: string;
    priority: string;
    order_date: string;
    assigned_to: number | null;
    assigned_user: { id: number; name: string } | null;
    notes?: string;
    version: number;
    items: {
        id: number;
        product_id: number;
        product_name?: string;
        sku?: string;
        quantity: number;
        unit_price: number | string;
        line_subtotal: number | string;
        product?: { name: string; sku: string };
    }[];
    status_history: {
        id: number;
        from_status: string | null;
        to_status: string;
        remarks: string | null;
        created_at: string;
        user?: { name: string };
        changed_by?: { name: string };
        changer?: { name: string };
    }[];
    activities?: {
        id: number;
        action: string;
        description: string;
        created_at: string;
        causer?: { name: string };
    }[];
    order_notes?: {
        id: number;
        note: string;
        created_at: string;
        user?: { name: string };
    }[];
    notes_list?: {
        id: number;
        body: string;
        created_at: string;
        user?: { name: string };
    }[];
    permissions?: {
        can_view?: boolean;
        can_edit?: boolean;
        can_change_status?: boolean;
        can_assign?: boolean;
        can_cancel?: boolean;
        can_delete?: boolean;
        can_add_note?: boolean;
    };
    allowed_transitions?: string[];
}

export const OrderDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [order, setOrder] = useState<OrderDetail | null>(null);
    const [staffList, setStaffList] = useState<{ id: number; name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [forbidden, setForbidden] = useState(false);

    // Modal states
    const [statusModalOpen, setStatusModalOpen] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState("");
    const [statusRemarks, setStatusRemarks] = useState("");

    const [assignModalOpen, setAssignModalOpen] = useState(false);
    const [selectedAssignee, setSelectedAssignee] = useState("");

    const [noteModalOpen, setNoteModalOpen] = useState(false);
    const [noteInput, setNoteInput] = useState("");

    const [cancelModalOpen, setCancelModalOpen] = useState(false);
    const [cancelReason, setCancelReason] = useState("");
    const [cancelError, setCancelError] = useState("");

    const [deleteModalOpen, setDeleteModalOpen] = useState(false);

    // Trigger refs for focus restoration
    const statusBtnRef = useRef<HTMLButtonElement | null>(null);
    const assignBtnRef = useRef<HTMLButtonElement | null>(null);
    const noteBtnRef = useRef<HTMLButtonElement | null>(null);
    const cancelBtnRef = useRef<HTMLButtonElement | null>(null);
    const deleteBtnRef = useRef<HTMLButtonElement | null>(null);

    const fetchOrder = async () => {
        if (!id) return;
        setLoading(true);
        setNotFound(false);
        setForbidden(false);
        try {
            const res = await api.get<OrderDetail>(`/orders/${id}`);
            setOrder(res.data);
            if (res.data?.allowed_transitions && res.data.allowed_transitions.length > 0) {
                setSelectedStatus(res.data.allowed_transitions[0]);
            }
        } catch (err: unknown) {
            if (err instanceof ApiClientError) {
                if (err.status === 403) setForbidden(true);
                else if (err.status === 404) setNotFound(true);
                else setNotFound(true);
            } else {
                setNotFound(true);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrder();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    useEffect(() => {
        api.get("/users/assignable").then((res) => setStaffList(res.data || [])).catch(() => {});
    }, []);

    if (loading) {
        return (
            <div data-testid="order-detail-skeleton" className="max-w-7xl mx-auto px-4 py-8 space-y-6">
                <div className="h-8 bg-gray-200 rounded w-1/4 animate-pulse" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="h-48 bg-gray-100 rounded-xl animate-pulse md:col-span-2" />
                    <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
                </div>
                <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
            </div>
        );
    }

    if (forbidden) {
        return (
            <div data-testid="forbidden-page" className="min-h-[80vh] flex flex-col items-center justify-center p-4">
                <h1 data-testid="page-title" className="text-3xl font-extrabold text-gray-900 mb-2">403 — Forbidden</h1>
                <p className="text-gray-600 mb-6">You do not have permission to view this order.</p>
                <Link to="/orders" className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-semibold min-h-[38px] flex items-center">
                    Return to Orders
                </Link>
            </div>
        );
    }

    if (notFound || !order) {
        return (
            <div data-testid="not-found-page" className="min-h-[80vh] flex flex-col items-center justify-center p-4">
                <h1 data-testid="page-title" className="text-3xl font-extrabold text-gray-900 mb-2">Order Not Found</h1>
                <p  className="text-gray-600 mb-6">Unable to find requested order.</p>
                <Link to="/orders" className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-semibold min-h-[38px] flex items-center">
                    Return to Orders
                </Link>
            </div>
        );
    }

    const isTerminal = ["completed", "cancelled"].includes(order.status);
    const isAdmin = user?.role === "admin" || user?.role === "super-admin";
    const isManager = user?.role === "manager";

    // Actions visibility rules per spec & tests
    const canEdit = !isTerminal && (isAdmin || isManager) && (order.permissions?.can_edit ?? true);
    const canChangeStatus = !isTerminal && (order.allowed_transitions?.length ?? 0) > 0;
    const canAssign = !isTerminal && (isAdmin || isManager);
    const canCancel = !isTerminal && (isAdmin || isManager) && (order.permissions?.can_cancel ?? true);
    const canDelete = isAdmin && order.status === "draft";
    const canAddNote = true; // anyone who can view order

    // Handle Status Change
    const handleStatusSubmit = async () => {
        if (!selectedStatus) return;
        try {
            await api.patch(`/orders/${order.id}/status`, {
                status: selectedStatus,
                remarks: statusRemarks || undefined,
            });
            toast.success(`Order status updated to ${selectedStatus}`);
            setStatusModalOpen(false);
            setStatusRemarks("");
            fetchOrder();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to update order status.");
        }
    };

    // Handle Assignment
    const handleAssignSubmit = async () => {
        if (!selectedAssignee) return;
        try {
            await api.patch(`/orders/${order.id}/assign`, {
                assigned_to: parseInt(selectedAssignee, 10),
            });
            toast.success("Order assignee updated.");
            setAssignModalOpen(false);
            fetchOrder();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to assign order.");
        }
    };

    // Handle Add Note
    const handleNoteSubmit = async () => {
        if (!noteInput.trim()) return;
        try {
            await api.post(`/orders/${order.id}/notes`, {
                note: noteInput.trim(),
            });
            toast.success("Note added successfully.");
            setNoteModalOpen(false);
            setNoteInput("");
            fetchOrder();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to add note.");
        }
    };

    // Handle Cancel
    const handleCancelSubmit = async () => {
        if (!cancelReason.trim()) {
            setCancelError("Reason is required to cancel an order.");
            return;
        }
        setCancelError("");
        try {
            await api.patch(`/orders/${order.id}/status`, {
                status: "cancelled",
                remarks: cancelReason.trim(),
            });
            toast.success("Order cancelled.");
            setCancelModalOpen(false);
            setCancelReason("");
            fetchOrder();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to cancel order.");
        }
    };

    // Handle Delete
    const handleDeleteSubmit = async () => {
        try {
            await api.delete(`/orders/${order.id}`);
            toast.success("Order deleted.");
            setDeleteModalOpen(false);
            navigate("/orders");
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to delete order.");
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 overflow-x-hidden">
            {/* Header with Title and Actions */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-gray-200">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 data-testid="page-title" className="text-3xl font-extrabold text-gray-900 tracking-tight">
                            Order <span data-testid="order-number">{order.order_number}</span>
                        </h1>
                        <span
                            data-testid="order-status"
                            className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                                order.status === "completed"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : order.status === "cancelled"
                                    ? "bg-rose-100 text-rose-800"
                                    : order.status === "pending"
                                    ? "bg-amber-100 text-amber-800"
                                    : order.status === "confirmed"
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-purple-100 text-purple-800"
                            }`}
                        >
                            {capitalize(order.status)}
                        </span>
                        <span
                            data-testid="order-priority"
                            className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-700 capitalize"
                        >
                            {capitalize(order.priority)}
                        </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Placed on {order.order_date}</p>
                </div>

                {/* Actions Toolbar */}
                <div className="flex flex-wrap items-center gap-2">
                    {canEdit && (
                        <Link
                            to={`/orders/${order.id}/edit`}
                            data-testid="action-edit"
                            className="px-3 py-2 border border-gray-300 rounded-md text-xs font-semibold text-gray-700 hover:bg-gray-50 min-h-[38px] flex items-center"
                        >
                            Edit
                        </Link>
                    )}
                    {canChangeStatus && (
                        <button
                            ref={statusBtnRef}
                            type="button"
                            data-testid="action-status"
                            onClick={() => {
                                if (order.allowed_transitions && order.allowed_transitions.length > 0) {
                                    setSelectedStatus(order.allowed_transitions[0]);
                                }
                                setStatusModalOpen(true);
                            }}
                            className="px-3 py-2 bg-indigo-600 text-white rounded-md text-xs font-semibold hover:bg-indigo-700 min-h-[38px] flex items-center"
                        >
                            Change Status
                        </button>
                    )}
                    {canAssign && (
                        <button
                            ref={assignBtnRef}
                            type="button"
                            data-testid="action-assign"
                            onClick={() => {
                                setSelectedAssignee(order.assigned_to ? String(order.assigned_to) : "");
                                setAssignModalOpen(true);
                            }}
                            className="px-3 py-2 border border-gray-300 rounded-md text-xs font-semibold text-gray-700 hover:bg-gray-50 min-h-[38px] flex items-center"
                        >
                            Assign
                        </button>
                    )}
                    {canAddNote && (
                        <button
                            ref={noteBtnRef}
                            type="button"
                            data-testid="action-note"
                            onClick={() => setNoteModalOpen(true)}
                            className="px-3 py-2 border border-gray-300 rounded-md text-xs font-semibold text-gray-700 hover:bg-gray-50 min-h-[38px] flex items-center"
                        >
                            Add Note
                        </button>
                    )}
                    {canCancel && (
                        <button
                            ref={cancelBtnRef}
                            type="button"
                            data-testid="action-cancel"
                            onClick={() => {
                                setCancelError("");
                                setCancelReason("");
                                setCancelModalOpen(true);
                            }}
                            className="px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-md text-xs font-semibold hover:bg-rose-100 min-h-[38px] flex items-center"
                        >
                            Cancel Order
                        </button>
                    )}
                    {canDelete && (
                        <button
                            ref={deleteBtnRef}
                            type="button"
                            data-testid="action-delete"
                            onClick={() => setDeleteModalOpen(true)}
                            className="px-3 py-2 bg-red-600 text-white rounded-md text-xs font-semibold hover:bg-red-700 min-h-[38px] flex items-center"
                        >
                            Delete
                        </button>
                    )}
                </div>
            </div>

            {/* Info Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Customer Info Card */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 space-y-2">
                    <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Customer</h2>
                    <div data-testid="order-customer-name" className="text-base font-bold text-gray-900">
                        {order.customer?.name || "N/A"}
                    </div>
                    <div data-testid="order-customer-email" className="text-sm text-gray-500">
                        {order.customer?.email}
                    </div>
                    {order.customer?.phone && (
                        <div className="text-xs text-gray-400">{order.customer.phone}</div>
                    )}
                </div>

                {/* Assignment & Details */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 space-y-2">
                    <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Fulfillment</h2>
                    <div className="text-sm text-gray-600">
                        Assignee:{" "}
                        <span data-testid="order-assignee" className="font-bold text-gray-900">
                            {order.assigned_user?.name || "Unassigned"}
                        </span>
                    </div>
                    <div className="text-xs text-gray-400">
                        Priority: <span className="font-semibold capitalize text-gray-700">{order.priority}</span>
                    </div>
                </div>

                {/* Financial Summary */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 space-y-2">
                    <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Financial Total</h2>
                    <div data-testid="order-total" className="text-2xl font-black text-indigo-700">
                        {formatMoney(order.total)}
                    </div>
                    <div className="text-xs text-gray-400 flex justify-between">
                        <span>Subtotal: {formatMoney(order.subtotal)}</span>
                        <span>Tax: {formatMoney(order.tax_amount)}</span>
                    </div>
                </div>
            </div>

            {/* Line Items Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                    <h2 className="text-base font-bold text-gray-900">Order Items</h2>
                </div>
                <div className="overflow-x-auto">
                    <table data-testid="order-items-table" className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left">Product</th>
                                <th scope="col" className="px-6 py-3 text-left">SKU</th>
                                <th scope="col" className="px-6 py-3 text-right">Unit Price</th>
                                <th scope="col" className="px-6 py-3 text-center">Qty</th>
                                <th scope="col" className="px-6 py-3 text-right">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {(order.items || []).map((item) => (
                                <tr key={item.id} data-testid="order-item-row">
                                    <td className="px-6 py-4 font-semibold text-gray-900">
                                        {item.product?.name || item.product_name || `Product #${item.product_id}`}
                                    </td>
                                    <td className="px-6 py-4 font-mono text-xs text-gray-500">
                                        {item.product?.sku || item.sku || "N/A"}
                                    </td>
                                    <td className="px-6 py-4 text-right text-gray-700">
                                        {formatMoney(item.unit_price)}
                                    </td>
                                    <td className="px-6 py-4 text-center font-bold text-gray-900">
                                        {item.quantity}
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold text-gray-900">
                                        {formatMoney(item.line_subtotal)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Timeline & Activity Feed Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Status Timeline */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h2 className="text-base font-bold text-gray-900 mb-4">Status History Timeline</h2>
                    <div data-testid="order-timeline" className="space-y-4">
                        {(order.status_history || []).length === 0 ? (
                            <div className="text-xs text-gray-400">No status changes yet.</div>
                        ) : (
                            order.status_history.map((hist, idx) => (
                                <div key={hist.id || idx} className="flex gap-3 text-sm">
                                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 mt-1.5 flex-shrink-0" />
                                    <div className="flex-1">
                                        <div className="font-semibold text-gray-900 capitalize">
                                            Status: {hist.to_status}
                                            {hist.from_status && (
                                                <span className="text-xs font-normal text-gray-500"> (from {hist.from_status})</span>
                                            )}
                                        </div>
                                        {hist.remarks && (
                                            <div className="text-xs text-gray-600 italic mt-0.5">{hist.remarks}</div>
                                        )}
                                        <div className="text-[10px] text-gray-400 mt-1">
                                            by {hist.user?.name || hist.changed_by?.name || hist.changer?.name || "System"} • {new Date(hist.created_at).toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Activity Feed & Notes */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h2 className="text-base font-bold text-gray-900 mb-4">Activity & Notes Feed</h2>
                    <div data-testid="order-activity" className="space-y-3">
                        {/* Combine notes and activities */}
                        {(() => {
                            const notes = (order.notes_list || order.order_notes || []).map((n: { id: number; body?: string; note?: string; created_at: string; user?: { name: string; } }) => ({
                                id: `note-${n.id}`,
                                text: n.body || n.note,
                                author: n.user?.name || "Staff",
                                date: n.created_at,
                                isNote: true,
                            }));
                            const acts = (order.activities || []).map((a: { id: number; description?: string; action?: string; causer?: { name: string; }; created_at: string }) => ({
                                id: `act-${a.id}`,
                                text: a.description || a.action,
                                author: a.causer?.name || "User",
                                date: a.created_at,
                                isNote: false,
                            }));
                            const combined = [...notes, ...acts].sort(
                                (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
                            );

                            if (combined.length === 0) {
                                return <div className="text-xs text-gray-400">No activity logged.</div>;
                            }

                            return combined.map((entry) => (
                                <div key={entry.id} className="p-3 bg-slate-50 rounded-lg text-xs space-y-1">
                                    {/* Text rendered purely as text, not HTML for XSS prevention */}
                                    <div className="text-gray-900 font-medium whitespace-pre-wrap">
                                        {entry.text}
                                    </div>
                                    <div className="text-[10px] text-gray-400">
                                        {entry.author} • {new Date(entry.date).toLocaleString()}
                                    </div>
                                </div>
                            ));
                        })()}
                    </div>
                </div>
            </div>

            {/* MODAL 1: Status Change Modal */}
            <Modal
                isOpen={statusModalOpen}
                onClose={() => setStatusModalOpen(false)}
                title="Change Order Status"
                triggerRef={statusBtnRef}
            >
                <div className="space-y-4">
                    <div>
                        <label htmlFor="status-select" className="block text-sm font-semibold text-gray-700 mb-1">
                            New Status
                        </label>
                        <select
                            id="status-select"
                            data-testid="status-select"
                            value={selectedStatus}
                            onChange={(e) => setSelectedStatus(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[38px] text-gray-900"
                        >
                            {(order.allowed_transitions || []).map((t) => (
                                <option key={t} value={t}>
                                    {capitalize(t)}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="status-remarks" className="block text-sm font-semibold text-gray-700 mb-1">
                            Remarks / Reason
                        </label>
                        <input
                            id="status-remarks"
                            type="text"
                            data-testid="status-remarks"
                            value={statusRemarks}
                            onChange={(e) => setStatusRemarks(e.target.value)}
                            placeholder="Optional notes about this transition..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[38px] text-gray-900"
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={() => setStatusModalOpen(false)}
                            className="px-4 py-2 border border-gray-300 rounded-md text-xs font-semibold text-gray-700 hover:bg-gray-50 min-h-[36px]"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            data-testid="status-submit"
                            onClick={handleStatusSubmit}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-md text-xs font-semibold hover:bg-indigo-700 min-h-[36px]"
                        >
                            Confirm Status Change
                        </button>
                    </div>
                </div>
            </Modal>

            {/* MODAL 2: Assign Modal */}
            <Modal
                isOpen={assignModalOpen}
                onClose={() => setAssignModalOpen(false)}
                title="Assign Order"
                triggerRef={assignBtnRef}
            >
                <div className="space-y-4">
                    <div>
                        <label htmlFor="assign-select" className="block text-sm font-semibold text-gray-700 mb-1">
                            Select Assignee
                        </label>
                        <select
                            id="assign-select"
                            data-testid="assign-select"
                            value={selectedAssignee}
                            onChange={(e) => setSelectedAssignee(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[38px] text-gray-900"
                        >
                            <option value="">Select staff member...</option>
                            {staffList.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={() => setAssignModalOpen(false)}
                            className="px-4 py-2 border border-gray-300 rounded-md text-xs font-semibold text-gray-700 hover:bg-gray-50 min-h-[36px]"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            data-testid="assign-submit"
                            onClick={handleAssignSubmit}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-md text-xs font-semibold hover:bg-indigo-700 min-h-[36px]"
                        >
                            Save Assignment
                        </button>
                    </div>
                </div>
            </Modal>

            {/* MODAL 3: Add Note Modal */}
            <Modal
                isOpen={noteModalOpen}
                onClose={() => setNoteModalOpen(false)}
                title="Add Internal Note"
                triggerRef={noteBtnRef}
            >
                <div className="space-y-4">
                    <div>
                        <label htmlFor="note-input" className="block text-sm font-semibold text-gray-700 mb-1">
                            Note Details
                        </label>
                        <textarea
                            id="note-input"
                            rows={3}
                            data-testid="note-input"
                            value={noteInput}
                            onChange={(e) => setNoteInput(e.target.value)}
                            placeholder="Type internal collaboration note..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900"
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={() => setNoteModalOpen(false)}
                            className="px-4 py-2 border border-gray-300 rounded-md text-xs font-semibold text-gray-700 hover:bg-gray-50 min-h-[36px]"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            data-testid="note-submit"
                            onClick={handleNoteSubmit}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-md text-xs font-semibold hover:bg-indigo-700 min-h-[36px]"
                        >
                            Add Note
                        </button>
                    </div>
                </div>
            </Modal>

            {/* MODAL 4: Cancel Order Modal */}
            <Modal
                isOpen={cancelModalOpen}
                onClose={() => setCancelModalOpen(false)}
                title="Cancel Order"
                triggerRef={cancelBtnRef}
            >
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                        Please provide a mandatory reason for cancelling this order. Stock will be restored if previously reserved.
                    </p>

                    <div>
                        <label htmlFor="cancel-reason" className="block text-sm font-semibold text-gray-700 mb-1">
                            Cancellation Reason <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="cancel-reason"
                            type="text"
                            data-testid="cancel-reason"
                            value={cancelReason}
                            onChange={(e) => {
                                setCancelReason(e.target.value);
                                if (e.target.value.trim()) setCancelError("");
                            }}
                            placeholder="e.g. Customer changed their mind..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[38px] text-gray-900"
                        />
                        {cancelError && (
                            <p data-testid="field-error" className="text-xs text-red-600 font-semibold mt-1">
                                {cancelError}
                            </p>
                        )}
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            data-testid="confirm-cancel"
                            onClick={() => setCancelModalOpen(false)}
                            className="px-4 py-2 border border-gray-300 rounded-md text-xs font-semibold text-gray-700 hover:bg-gray-50 min-h-[36px]"
                        >
                            Close
                        </button>
                        <button
                            type="button"
                            data-testid="confirm-ok"
                            onClick={handleCancelSubmit}
                            className="px-4 py-2 bg-rose-600 text-white rounded-md text-xs font-semibold hover:bg-rose-700 min-h-[36px]"
                        >
                            Confirm Cancellation
                        </button>
                    </div>
                </div>
            </Modal>

            {/* MODAL 5: Delete Order Modal */}
            <Modal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                title="Delete Draft Order"
                triggerRef={deleteBtnRef}
            >
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                        Are you sure you want to permanently delete this draft order? This action cannot be undone.
                    </p>

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            data-testid="confirm-cancel"
                            onClick={() => setDeleteModalOpen(false)}
                            className="px-4 py-2 border border-gray-300 rounded-md text-xs font-semibold text-gray-700 hover:bg-gray-50 min-h-[36px]"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            data-testid="confirm-ok"
                            onClick={handleDeleteSubmit}
                            className="px-4 py-2 bg-red-600 text-white rounded-md text-xs font-semibold hover:bg-red-700 min-h-[36px]"
                        >
                            Delete Order
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
