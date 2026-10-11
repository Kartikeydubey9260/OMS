import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../state/auth";
import { api, ApiClientError } from "../api/client";
import { toast } from "../components/ToastContainer";
import { Modal } from "../components/Modal";

interface Customer {
    id: number;
    name: string;
    email: string;
    phone?: string;
    company?: string;
    is_active: boolean | number;
    created_at: string;
    orders_count?: number;
}

export const CustomersListPage: React.FC = () => {
    const { hasRole } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();

    const searchParam = searchParams.get("search") || "";
    const statusParam = searchParams.get("is_active") || "";
    const sortParam = searchParams.get("sort") || "created_at";
    const directionParam = (searchParams.get("direction") as "asc" | "desc") || "desc";
    const pageParam = parseInt(searchParams.get("page") || "1", 10);
    const perPageParam = parseInt(searchParams.get("per_page") || "10", 10);

    const [searchInput, setSearchInput] = useState(searchParam);
    const [statusFilter, setStatusFilter] = useState(statusParam);
    const [sort, setSort] = useState(sortParam);
    const [direction, setDirection] = useState<"asc" | "desc">(directionParam);
    const [page, setPage] = useState(pageParam);
    const [perPage, setPerPage] = useState(perPageParam);

    const [customers, setCustomers] = useState<Customer[]>([]);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
    const [deleting, setDeleting] = useState(false);

    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    const canManage = hasRole(["admin", "super-admin", "manager"]);
    const canDelete = hasRole(["admin", "super-admin"]);

    const updateParams = useCallback(
        (updates: Record<string, string | number | undefined>) => {
            setSearchParams(
                (prev) => {
                    const next = new URLSearchParams(prev);
                    Object.entries(updates).forEach(([k, v]) => {
                        if (v === undefined || v === "" || (k === "page" && v === 1)) {
                            next.delete(k);
                        } else {
                            next.set(k, String(v));
                        }
                    });
                    return next;
                },
                { replace: true }
            );
        },
        [setSearchParams]
    );

    const fetchCustomers = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            const urlSearch = searchParams.get("search") || "";
            if (urlSearch.trim()) params.append("search", urlSearch.trim());
            if (statusFilter) params.append("is_active", statusFilter);
            if (sort) params.append("sort", sort);
            if (direction) params.append("direction", direction);
            params.append("page", String(page));
            params.append("per_page", String(perPage));

            const res = await api.get(`/customers?${params.toString()}`);
            setCustomers(res.data || []);
            if (res.meta) {
                setTotalPages(res.meta.last_page || 1);
                setTotal(res.meta.total || 0);
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Unable to load customers.");
        } finally {
            setLoading(false);
        }
    }, [searchParams, statusFilter, sort, direction, page, perPage]);

    const handleSearchChange = (val: string) => {
        setSearchInput(val);
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
            setPage(1);
            updateParams({ search: val, page: 1 });
        }, 300);
    };

    useEffect(() => {
        fetchCustomers();
    }, [fetchCustomers]);

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
        updateParams({ is_active: val, page: 1 });
    };

    const handleDelete = async () => {
        const target = deleteTarget;
        if (!target) return;
        setDeleting(true);
        try {
            await api.delete(`/customers/${target.id}`);
            toast.success("Customer deleted successfully.");
            setCustomers((prev) => prev.filter((c) => c.id !== target.id));
            setDeleteTarget(null);
            await fetchCustomers();
        } catch (err: unknown) {
            const msg =
                err instanceof ApiClientError ? err.message : "Unable to delete customer.";
            toast.error(msg);
            setDeleteTarget(null);
        } finally {
            setDeleting(false);
        }
    };

    const sortMarker = (col: string) =>
        sort === col ? (direction === "asc" ? " ↑" : " ↓") : "";

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 overflow-x-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h1 data-testid="page-title" className="text-3xl font-extrabold text-gray-900 tracking-tight">
                    Customers Directory
                </h1>
                {canManage && (
                    <Link
                        to="/customers/new"
                        data-testid="customer-new"
                        className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-semibold hover:bg-indigo-700 min-h-[38px]"
                    >
                        + New Customer
                    </Link>
                )}
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="lg:col-span-2">
                    <label htmlFor="customers-search" className="block text-xs font-semibold text-gray-500 mb-1">
                        Search Customers
                    </label>
                    <input
                        id="customers-search"
                        type="text"
                        data-testid="customers-search"
                        placeholder="Search by name, email or company..."
                        value={searchInput}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[38px] text-gray-900"
                    />
                </div>

                <div>
                    <label htmlFor="customers-filter-status" className="block text-xs font-semibold text-gray-500 mb-1">
                        Status
                    </label>
                    <select
                        id="customers-filter-status"
                        data-testid="customers-filter-status"
                        value={statusFilter}
                        onChange={(e) => handleStatusFilterChange(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[38px] text-gray-900"
                    >
                        <option value="">All Statuses</option>
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                    </select>
                </div>
            </div>

            {error && (
                <div
                    data-testid="customers-error"
                    role="alert"
                    className="p-4 rounded-md bg-red-50 border border-red-200 text-red-700 flex items-center justify-between"
                >
                    <div>
                        <span className="font-bold">Error:</span> {error}
                    </div>
                    <button
                        type="button"
                        data-testid="customers-retry"
                        onClick={fetchCustomers}
                        className="px-3 py-1.5 bg-red-600 text-white rounded text-xs font-semibold hover:bg-red-700 min-h-[36px]"
                    >
                        Retry
                    </button>
                </div>
            )}

            {loading && (
                <div data-testid="customers-skeleton" className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
                    ))}
                </div>
            )}

            {!loading && !error && (
                <>
                    {customers.length === 0 ? (
                        <div
                            data-testid="customers-empty"
                            className="text-center py-12 bg-white rounded-xl border border-gray-100 text-gray-500 font-medium"
                        >
                            No customers found.
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
                            <table data-testid="customers-table" className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th
                                            scope="col"
                                            onClick={() => handleSortToggle("name")}
                                            data-testid="customers-sort-name"
                                            className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                        >
                                            Customer Name{sortMarker("name")}
                                        </th>
                                        <th
                                            scope="col"
                                            onClick={() => handleSortToggle("email")}
                                            data-testid="customers-sort-email"
                                            className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                        >
                                            Email{sortMarker("email")}
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                                            Phone
                                        </th>
                                        <th
                                            scope="col"
                                            onClick={() => handleSortToggle("created_at")}
                                            data-testid="customers-sort-created_at"
                                            className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                        >
                                            Created{sortMarker("created_at")}
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-100">
                                    {customers.map((c) => (
                                        <tr key={c.id} data-testid="customer-row" className="hover:bg-slate-50 transition">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                                <Link to={`/customers/${c.id}`} className="hover:underline text-indigo-600">
                                                    {c.name}
                                                </Link>
                                                {c.is_active !== undefined && !c.is_active && (
                                                    <span className="ml-2 px-2 py-0.5 rounded text-xs font-bold uppercase bg-rose-100 text-rose-800">
                                                        Inactive
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{c.email}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{c.phone || "—"}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {c.created_at ? new Date(c.created_at).toLocaleDateString("en-US") : "—"}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Link
                                                        to={`/customers/${c.id}`}
                                                        data-testid="customer-view"
                                                        className="text-indigo-600 hover:text-indigo-900 min-h-[36px] inline-flex items-center px-2 py-1"
                                                    >
                                                        View
                                                    </Link>
                                                    {canManage && (
                                                        <Link
                                                            to={`/customers/${c.id}/edit`}
                                                            data-testid="customer-edit"
                                                            className="text-amber-600 hover:text-amber-800 min-h-[36px] inline-flex items-center px-2 py-1"
                                                        >
                                                            Edit
                                                        </Link>
                                                    )}
                                                    {canDelete && (
                                                        <button
                                                            type="button"
                                                            data-testid="customer-delete"
                                                            onClick={() => setDeleteTarget(c)}
                                                            className="text-rose-600 hover:text-rose-800 min-h-[36px] inline-flex items-center px-2 py-1 font-medium"
                                                        >
                                                            Delete
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div
                        data-testid="customers-pagination"
                        className="bg-white px-4 py-3 rounded-xl border border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4"
                    >
                        <div className="flex items-center gap-2">
                            <label htmlFor="customers-per-page" className="text-xs text-gray-600">Per page:</label>
                            <select
                                id="customers-per-page"
                                data-testid="customers-per-page"
                                value={perPage}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value, 10);
                                    setPerPage(val);
                                    setPage(1);
                                    updateParams({ per_page: val, page: 1 });
                                }}
                                className="border border-gray-300 rounded px-2 py-1 text-xs min-h-[36px]"
                            >
                                <option value="5">5</option>
                                <option value="10">10</option>
                                <option value="15">15</option>
                                <option value="25">25</option>
                                <option value="50">50</option>
                                <option value="100">100</option>
                            </select>
                            <span data-testid="customers-page-info" className="text-xs text-gray-600 ml-2">
                                Page {page} of {Math.max(totalPages, 1)} ({total} total)
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                data-testid="customers-prev"
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
                                data-testid="customers-next"
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

            <Modal
                isOpen={deleteTarget !== null}
                onClose={() => setDeleteTarget(null)}
                title="Delete Customer"
            >
                <p className="text-sm text-gray-600">
                    Are you sure you want to delete{" "}
                    <span className="font-semibold text-gray-900">{deleteTarget?.name}</span>? This
                    cannot be undone.
                </p>
                <div className="mt-6 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={() => setDeleteTarget(null)}
                        className="px-4 py-2 border border-gray-300 rounded-md text-sm font-semibold text-gray-700 hover:bg-gray-50 min-h-[38px]"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        data-testid="customer-delete-confirm"
                        disabled={deleting}
                        onClick={handleDelete}
                        className="px-4 py-2 bg-rose-600 text-white rounded-md text-sm font-semibold hover:bg-rose-700 disabled:opacity-50 min-h-[38px]"
                    >
                        {deleting ? "Deleting..." : "Delete"}
                    </button>
                </div>
            </Modal>
        </div>
    );
};