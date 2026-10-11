import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../state/auth";
import { api } from "../api/client";
import { formatMoney, capitalize } from "../utils/formatters";

interface OrderItem {
    id: number;
    order_number: string;
    customer_id: number;
    customer?: { id: number; name: string; email: string };
    total: number | string;
    status: string;
    priority: string;
    order_date: string;
    assigned_user?: { id: number; name: string } | null;
}

interface UserOption {
    id: number;
    name: string;
}

export const OrdersListPage: React.FC = () => {
    const { hasRole } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();

    // Read initial filters from search params
    const searchParam = searchParams.get("search") || "";
    const statusParam = searchParams.get("status") || "";
    const priorityParam = searchParams.get("priority") || "";
    const assigneeParam = searchParams.get("assigned_to") || "";
    const dateFromParam = searchParams.get("date_from") || "";
    const dateToParam = searchParams.get("date_to") || "";
    const sortParam = searchParams.get("sort") || "created_at";
    const directionParam = (searchParams.get("direction") as "asc" | "desc") || "desc";
    const pageParam = parseInt(searchParams.get("page") || "1", 10);
    const perPageParam = parseInt(searchParams.get("per_page") || "10", 10);

    const [searchInput, setSearchInput] = useState(searchParam);
    const [statusFilter, setStatusFilter] = useState(statusParam);
    const [priorityFilter, setPriorityFilter] = useState(priorityParam);
    const [assigneeFilter, setAssigneeFilter] = useState(assigneeParam);
    const [dateFrom, setDateFrom] = useState(dateFromParam);
    const [dateTo, setDateTo] = useState(dateToParam);
    const [sort, setSort] = useState(sortParam);
    const [direction, setDirection] = useState<"asc" | "desc">(directionParam);
    const [page, setPage] = useState(pageParam);
    const [perPage, setPerPage] = useState(perPageParam);

    const [orders, setOrders] = useState<OrderItem[]>([]);
    const [staffList, setStaffList] = useState<UserOption[]>([]);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const canCreateOrder = hasRole(["admin", "super-admin", "manager"]);

    // Sync state with URL params
    const updateParams = useCallback((updates: Record<string, string | number | undefined>) => {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            Object.entries(updates).forEach(([k, v]) => {
                if (v === undefined || v === "" || (k === "page" && v === 1)) {
                    next.delete(k);
                } else {
                    next.set(k, String(v));
                }
            });
            return next;
        }, { replace: true });
    }, [setSearchParams]);

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            const urlSearch = searchParams.get("search") || "";
            if (urlSearch.trim()) params.append("search", urlSearch.trim());
            if (statusFilter) params.append("status", statusFilter);
            if (priorityFilter) params.append("priority", priorityFilter);
            if (assigneeFilter) params.append("assigned_to", assigneeFilter);
            if (dateFrom) params.append("date_from", dateFrom);
            if (dateTo) params.append("date_to", dateTo);
            if (sort) params.append("sort", sort);
            if (direction) params.append("direction", direction);
            params.append("page", String(page));
            params.append("per_page", String(perPage));

            const res = await api.get(`/orders?${params.toString()}`);
            setOrders(res.data || []);
            const meta = res.meta;
            if (meta) {
                setTotalPages(meta.last_page || 1);
            } else {
                setTotalPages(1);
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Unable to load orders.");
        } finally {
            setLoading(false);
        }
    }, [searchParams, statusFilter, priorityFilter, assigneeFilter, dateFrom, dateTo, sort, direction, page, perPage]);

    // Initial fetch of staff
    useEffect(() => {
        if (canCreateOrder) {
            api.get("/users/assignable").then((res) => {
                setStaffList(res.data || []);
            }).catch(() => {});
        }
    }, [canCreateOrder]);

    // Debounced search input handler
    const handleSearchChange = (val: string) => {
        setSearchInput(val);
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
            setPage(1);
            updateParams({ search: val, page: 1 });
        }, 300);
    };

    // Load orders whenever filters or pagination change
    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    const handleSortToggle = (col: string) => {
        let newDir: "asc" | "desc" = "asc";
        if (sort === col) {
            newDir = direction === "asc" ? "desc" : "asc";
        }
        setSort(col);
        setDirection(newDir);
        setPage(1);
        updateParams({ sort: col, direction: newDir, page: 1 });
    };

    const handleStatusFilterChange = (val: string) => {
        setStatusFilter(val);
        setPage(1);
        updateParams({ status: val, page: 1 });
    };

    const handlePriorityFilterChange = (val: string) => {
        setPriorityFilter(val);
        setPage(1);
        updateParams({ priority: val, page: 1 });
    };

    const handleAssigneeFilterChange = (val: string) => {
        setAssigneeFilter(val);
        setPage(1);
        updateParams({ assigned_to: val, page: 1 });
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 overflow-x-hidden">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h1 data-testid="page-title" className="text-3xl font-extrabold text-gray-900 tracking-tight">
                    Orders
                </h1>
                {canCreateOrder && (
                    <Link
                        to="/orders/new"
                        data-testid="orders-new"
                        className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none min-h-[38px]"
                    >
                        + Create Order
                    </Link>
                )}
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* Search Input */}
                <div className="lg:col-span-2">
                    <label htmlFor="orders-search" className="block text-xs font-semibold text-gray-500 mb-1">
                        Search Orders
                    </label>
                    <input
                        id="orders-search"
                        type="text"
                        data-testid="orders-search"
                        placeholder="Order #, customer, email..."
                        value={searchInput}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[38px] text-gray-900"
                    />
                </div>

                {/* Status Filter */}
                <div>
                    <label htmlFor="orders-filter-status" className="block text-xs font-semibold text-gray-500 mb-1">
                        Status
                    </label>
                    <select
                        id="orders-filter-status"
                        data-testid="orders-filter-status"
                        value={statusFilter}
                        onChange={(e) => handleStatusFilterChange(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[38px] text-gray-900"
                    >
                        <option value="">All Statuses</option>
                        <option value="draft">Draft</option>
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="processing">Processing</option>
                        <option value="ready">Ready</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                </div>

                {/* Priority Filter */}
                <div>
                    <label htmlFor="orders-filter-priority" className="block text-xs font-semibold text-gray-500 mb-1">
                        Priority
                    </label>
                    <select
                        id="orders-filter-priority"
                        data-testid="orders-filter-priority"
                        value={priorityFilter}
                        onChange={(e) => handlePriorityFilterChange(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[38px] text-gray-900"
                    >
                        <option value="">All Priorities</option>
                        <option value="low">Low</option>
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                    </select>
                </div>

                {/* Assignee Filter */}
                <div>
                    <label htmlFor="orders-filter-assignee" className="block text-xs font-semibold text-gray-500 mb-1">
                        Assignee
                    </label>
                    <select
                        id="orders-filter-assignee"
                        data-testid="orders-filter-assignee"
                        value={assigneeFilter}
                        onChange={(e) => handleAssigneeFilterChange(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[38px] text-gray-900"
                    >
                        <option value="">All Assignees</option>
                        {staffList.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Date range filters */}
                <div className="flex gap-2">
                    <div className="w-1/2">
                        <label htmlFor="orders-filter-from" className="block text-xs font-semibold text-gray-500 mb-1">From</label>
                        <input
                            id="orders-filter-from"
                            type="date"
                            data-testid="orders-filter-from"
                            value={dateFrom}
                            onChange={(e) => {
                                setDateFrom(e.target.value);
                                setPage(1);
                                updateParams({ date_from: e.target.value, page: 1 });
                            }}
                            className="w-full px-2 py-2 border border-gray-300 rounded-md text-xs min-h-[38px]"
                        />
                    </div>
                    <div className="w-1/2">
                        <label htmlFor="orders-filter-to" className="block text-xs font-semibold text-gray-500 mb-1">To</label>
                        <input
                            id="orders-filter-to"
                            type="date"
                            data-testid="orders-filter-to"
                            value={dateTo}
                            onChange={(e) => {
                                setDateTo(e.target.value);
                                setPage(1);
                                updateParams({ date_to: e.target.value, page: 1 });
                            }}
                            className="w-full px-2 py-2 border border-gray-300 rounded-md text-xs min-h-[38px]"
                        />
                    </div>
                </div>
            </div>

            {/* Error State */}
            {error && (
                <div
                    data-testid="orders-error"
                    role="alert"
                    className="p-4 rounded-md bg-red-50 border border-red-200 text-red-700 flex items-center justify-between"
                >
                    <div>
                        <span className="font-bold">Error:</span> {error === "Unable to load orders." ? error : `Unable to load orders. (${error})`}
                    </div>
                    <button
                        type="button"
                        data-testid="orders-retry"
                        onClick={fetchOrders}
                        className="px-3 py-1.5 bg-red-600 text-white rounded text-xs font-semibold hover:bg-red-700 min-h-[36px]"
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* Loading Skeleton */}
            {loading && (
                <div data-testid="orders-skeleton" className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
                    ))}
                </div>
            )}

            {/* Orders Table */}
            {!loading && !error && (
                <>
                    {orders.length === 0 ? (
                        <div
                            data-testid="orders-empty"
                            className="text-center py-12 bg-white rounded-xl border border-gray-100 text-gray-500 font-medium"
                        >
                            No orders found.
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
                            <table data-testid="orders-table" className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th
                                            scope="col"
                                            className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider"
                                        >
                                            Order Number
                                        </th>
                                        <th
                                            scope="col"
                                            onClick={() => handleSortToggle("customer")}
                                            data-testid="orders-sort-customer"
                                            className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                        >
                                            Customer
                                        </th>
                                        <th
                                            scope="col"
                                            onClick={() => handleSortToggle("order_date")}
                                            data-testid="orders-sort-order_date"
                                            className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                        >
                                            Date
                                        </th>
                                        <th
                                            scope="col"
                                            onClick={() => handleSortToggle("status")}
                                            data-testid="orders-sort-status"
                                            className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                        >
                                            Status
                                        </th>
                                        <th
                                            scope="col"
                                            onClick={() => handleSortToggle("priority")}
                                            data-testid="orders-sort-priority"
                                            className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                        >
                                            Priority
                                        </th>
                                        <th
                                            scope="col"
                                            onClick={() => handleSortToggle("total")}
                                            data-testid="orders-sort-total"
                                            className="px-6 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                        >
                                            Total {sort === "total" && (direction === "asc" ? "↑" : "↓")}
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-100">
                                    {orders.map((o) => (
                                        <tr
                                            key={o.id}
                                            data-testid="order-row"
                                            data-order-number={o.order_number}
                                            data-total={Number(o.total)}
                                            data-status={o.status}
                                            className="hover:bg-slate-50 transition-colors"
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-indigo-600">
                                                <Link to={`/orders/${o.id}`} className="hover:underline">
                                                    {o.order_number}
                                                </Link>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                <div>{o.customer?.name || "N/A"}</div>
                                                <div className="text-xs text-gray-500">{o.customer?.email}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {o.order_date}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                <span
                                                    className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${
                                                        o.status === "completed"
                                                            ? "bg-emerald-100 text-emerald-800"
                                                            : o.status === "cancelled"
                                                            ? "bg-rose-100 text-rose-800"
                                                            : o.status === "pending"
                                                            ? "bg-amber-100 text-amber-800"
                                                            : o.status === "confirmed"
                                                            ? "bg-blue-100 text-blue-800"
                                                            : o.status === "processing"
                                                            ? "bg-purple-100 text-purple-800"
                                                            : "bg-gray-100 text-gray-800"
                                                    }`}
                                                >
                                                    {capitalize(o.status)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                <span
                                                    className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                                                        o.priority === "urgent"
                                                            ? "bg-red-50 text-red-700"
                                                            : o.priority === "high"
                                                            ? "bg-orange-50 text-orange-700"
                                                            : "bg-gray-50 text-gray-600"
                                                    }`}
                                                >
                                                    {capitalize(o.priority)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                                                {formatMoney(o.total)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <Link
                                                    to={`/orders/${o.id}`}
                                                    className="text-indigo-600 hover:text-indigo-900 min-h-[36px] inline-flex items-center px-2 py-1"
                                                >
                                                    View
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination Bar */}
                    <div
                        data-testid="orders-pagination"
                        className="bg-white px-4 py-3 rounded-xl border border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4"
                    >
                        <div className="flex items-center gap-2">
                            <label htmlFor="orders-per-page" className="text-xs text-gray-600">Per page:</label>
                            <select
                                id="orders-per-page"
                                data-testid="orders-per-page"
                                value={perPage}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value, 10);
                                    setPerPage(val);
                                    setPage(1);
                                    updateParams({ per_page: val, page: 1 });
                                }}
                                className="border border-gray-300 rounded px-2 py-1 text-xs min-h-[36px]"
                            >
                                <option value="2">2</option>
                                <option value="5">5</option>
                                <option value="10">10</option>
                                <option value="15">15</option>
                                <option value="25">25</option>
                                <option value="50">50</option>
                                <option value="100">100</option>
                            </select>
                            <span data-testid="orders-page-info" className="text-xs text-gray-600 ml-2">
                                Page {page} of {Math.max(totalPages, 1)}
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                data-testid="orders-prev"
                                disabled={page <= 1}
                                onClick={() => {
                                    const prevPage = Math.max(1, page - 1);
                                    setPage(prevPage);
                                    updateParams({ page: prevPage });
                                }}
                                className="px-3 py-1.5 border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed min-h-[36px]"
                            >
                                Previous
                            </button>
                            <button
                                type="button"
                                data-testid="orders-next"
                                disabled={page >= totalPages}
                                onClick={() => {
                                    const nextPage = Math.min(totalPages, page + 1);
                                    setPage(nextPage);
                                    updateParams({ page: nextPage });
                                }}
                                className="px-3 py-1.5 border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed min-h-[36px]"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
