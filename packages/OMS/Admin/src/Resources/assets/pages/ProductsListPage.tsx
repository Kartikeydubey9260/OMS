import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../state/auth";
import { api, ApiClientError } from "../api/client";
import { toast } from "../components/ToastContainer";
import { Modal } from "../components/Modal";
import { formatMoney, capitalize } from "../utils/formatters";

interface Product {
    id: number;
    name: string;
    sku: string;
    price: number | string;
    stock_quantity: number;
    status: string;
    low_stock_threshold?: number;
    created_at: string;
}

export const ProductsListPage: React.FC = () => {
    const { hasRole } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();

    // Only admin can manage products per assessment RBAC
    const canManage = hasRole(["admin", "super-admin"]);

    const searchParam = searchParams.get("search") || "";
    const statusParam = searchParams.get("status") || "";
    const lowStockParam = searchParams.get("low_stock") || "";
    const priceMinParam = searchParams.get("price_min") || "";
    const priceMaxParam = searchParams.get("price_max") || "";
    const sortParam = searchParams.get("sort") || "created_at";
    const directionParam = (searchParams.get("direction") as "asc" | "desc") || "desc";
    const pageParam = parseInt(searchParams.get("page") || "1", 10);
    const perPageParam = parseInt(searchParams.get("per_page") || "10", 10);

    const [searchInput, setSearchInput] = useState(searchParam);
    const [statusFilter, setStatusFilter] = useState(statusParam);
    const [lowStock, setLowStock] = useState(lowStockParam === "1");
    const [priceMinInput, setPriceMinInput] = useState(priceMinParam);
    const [priceMaxInput, setPriceMaxInput] = useState(priceMaxParam);
    const [sort, setSort] = useState(sortParam);
    const [direction, setDirection] = useState<"asc" | "desc">(directionParam);
    const [page, setPage] = useState(pageParam);
    const [perPage, setPerPage] = useState(perPageParam);

    const [products, setProducts] = useState<Product[]>([]);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
    const [deleting, setDeleting] = useState(false);

    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

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

    const fetchProducts = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            const urlSearch = searchParams.get("search") || "";
            if (urlSearch.trim()) params.append("search", urlSearch.trim());
            if (statusFilter) params.append("status", statusFilter);
            if (lowStock) params.append("low_stock", "1");
            const urlPriceMin = searchParams.get("price_min") || "";
            const urlPriceMax = searchParams.get("price_max") || "";
            if (urlPriceMin) params.append("price_min", urlPriceMin);
            if (urlPriceMax) params.append("price_max", urlPriceMax);
            if (sort) params.append("sort", sort);
            if (direction) params.append("direction", direction);
            params.append("page", String(page));
            params.append("per_page", String(perPage));

            const res = await api.get(`/products?${params.toString()}`);
            setProducts(res.data || []);
            if (res.meta) {
                setTotalPages(res.meta.last_page || 1);
                setTotal(res.meta.total || 0);
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Unable to load products.");
        } finally {
            setLoading(false);
        }
    }, [searchParams, statusFilter, lowStock, sort, direction, page, perPage]);

    const handleSearchChange = (val: string) => {
        setSearchInput(val);
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
            setPage(1);
            updateParams({ search: val, page: 1 });
        }, 300);
    };

    const handlePriceChange = (kind: "min" | "max", val: string) => {
        if (kind === "min") setPriceMinInput(val);
        else setPriceMaxInput(val);
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
            setPage(1);
            updateParams({ [kind === "min" ? "price_min" : "price_max"]: val, page: 1 });
        }, 300);
    };

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

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

    const handleLowStockChange = (checked: boolean) => {
        setLowStock(checked);
        setPage(1);
        updateParams({ low_stock: checked ? "1" : "", page: 1 });
    };

    const handleDelete = async () => {
        const target = deleteTarget;
        if (!target) return;
        setDeleting(true);
        try {
            await api.delete(`/products/${target.id}`);
            toast.success("Product deleted successfully.");
            setProducts((prev) => prev.filter((p) => p.id !== target.id));
            setDeleteTarget(null);
            await fetchProducts();
        } catch (err: unknown) {
            const msg =
                err instanceof ApiClientError ? err.message : "Unable to delete product.";
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
                    Product Catalog
                </h1>
                {canManage && (
                    <Link
                        to="/products/new"
                        data-testid="product-new"
                        className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-semibold hover:bg-indigo-700 min-h-[38px]"
                    >
                        + New Product
                    </Link>
                )}
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3">
                <div className="md:col-span-2">
                    <label htmlFor="products-search" className="block text-xs font-semibold text-gray-500 mb-1">
                        Search Catalog
                    </label>
                    <input
                        id="products-search"
                        type="text"
                        data-testid="products-search"
                        placeholder="Search by SKU or product name..."
                        value={searchInput}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[38px] text-gray-900"
                    />
                </div>

                <div>
                    <label htmlFor="products-filter-price-min" className="block text-xs font-semibold text-gray-500 mb-1">
                        Min Price ($)
                    </label>
                    <input
                        id="products-filter-price-min"
                        type="number"
                        min="0"
                        step="0.01"
                        data-testid="products-filter-price-min"
                        placeholder="0.00"
                        value={priceMinInput}
                        onChange={(e) => handlePriceChange("min", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[38px] text-gray-900"
                    />
                </div>

                <div>
                    <label htmlFor="products-filter-price-max" className="block text-xs font-semibold text-gray-500 mb-1">
                        Max Price ($)
                    </label>
                    <input
                        id="products-filter-price-max"
                        type="number"
                        min="0"
                        step="0.01"
                        data-testid="products-filter-price-max"
                        placeholder="No limit"
                        value={priceMaxInput}
                        onChange={(e) => handlePriceChange("max", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[38px] text-gray-900"
                    />
                </div>

                <div>
                    <label htmlFor="products-filter-status" className="block text-xs font-semibold text-gray-500 mb-1">
                        Status
                    </label>
                    <select
                        id="products-filter-status"
                        data-testid="products-filter-status"
                        value={statusFilter}
                        onChange={(e) => handleStatusFilterChange(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[38px] text-gray-900"
                    >
                        <option value="">All Statuses</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                </div>

                <div className="flex items-end">
                    <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 min-h-[38px] cursor-pointer">
                        <input
                            type="checkbox"
                            data-testid="products-filter-low-stock"
                            checked={lowStock}
                            onChange={(e) => handleLowStockChange(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                        />
                        Low stock only
                    </label>
                </div>
            </div>

            {error && (
                <div
                    data-testid="products-error"
                    role="alert"
                    className="p-4 rounded-md bg-red-50 border border-red-200 text-red-700 flex items-center justify-between"
                >
                    <div>
                        <span className="font-bold">Error:</span> {error}
                    </div>
                    <button
                        type="button"
                        data-testid="products-retry"
                        onClick={fetchProducts}
                        className="px-3 py-1.5 bg-red-600 text-white rounded text-xs font-semibold hover:bg-red-700 min-h-[36px]"
                    >
                        Retry
                    </button>
                </div>
            )}

            {loading && (
                <div data-testid="products-skeleton" className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
                    ))}
                </div>
            )}

            {!loading && !error && (
                <>
                    {products.length === 0 ? (
                        <div
                            data-testid="products-empty"
                            className="text-center py-12 bg-white rounded-xl border border-gray-100 text-gray-500 font-medium"
                        >
                            No products found.
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
                            <table data-testid="products-table" className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th
                                            scope="col"
                                            onClick={() => handleSortToggle("sku")}
                                            data-testid="products-sort-sku"
                                            className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                        >
                                            SKU{sortMarker("sku")}
                                        </th>
                                        <th
                                            scope="col"
                                            onClick={() => handleSortToggle("name")}
                                            data-testid="products-sort-name"
                                            className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                        >
                                            Product Name{sortMarker("name")}
                                        </th>
                                        <th
                                            scope="col"
                                            onClick={() => handleSortToggle("price")}
                                            data-testid="products-sort-price"
                                            className="px-6 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                        >
                                            Price{sortMarker("price")}
                                        </th>
                                        <th
                                            scope="col"
                                            onClick={() => handleSortToggle("stock_quantity")}
                                            data-testid="products-sort-stock"
                                            className="px-6 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                        >
                                            Stock{sortMarker("stock_quantity")}
                                        </th>
                                        <th
                                            scope="col"
                                            onClick={() => handleSortToggle("status")}
                                            data-testid="products-sort-status"
                                            className="px-6 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                        >
                                            Status{sortMarker("status")}
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-100">
                                    {products.map((p) => (
                                        <tr key={p.id} data-testid="product-row" className="hover:bg-slate-50 transition">
                                            <td className="px-6 py-4 whitespace-nowrap font-mono text-xs font-bold text-indigo-600">
                                                {p.sku}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                                {canManage ? (
                                                    <Link to={`/products/${p.id}/edit`} className="hover:underline text-indigo-600">
                                                        {p.name}
                                                    </Link>
                                                ) : (
                                                    p.name
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-gray-900">
                                                {formatMoney(p.price)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-semibold text-gray-700">
                                                {p.stock_quantity}
                                                {p.low_stock_threshold && p.stock_quantity <= p.low_stock_threshold ? (
                                                    <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-800">
                                                        Low
                                                    </span>
                                                ) : null}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <span
                                                    className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                                                        p.status === "active"
                                                            ? "bg-emerald-100 text-emerald-800"
                                                            : "bg-gray-100 text-gray-800"
                                                    }`}
                                                >
                                                    {capitalize(p.status)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                {canManage && (
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Link
                                                            to={`/products/${p.id}/edit`}
                                                            data-testid="product-edit"
                                                            className="text-amber-600 hover:text-amber-800 min-h-[36px] inline-flex items-center px-2 py-1"
                                                        >
                                                            Edit
                                                        </Link>
                                                        <button
                                                            type="button"
                                                            data-testid="product-delete"
                                                            onClick={() => setDeleteTarget(p)}
                                                            className="text-rose-600 hover:text-rose-800 min-h-[36px] inline-flex items-center px-2 py-1 font-medium"
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div
                        data-testid="products-pagination"
                        className="bg-white px-4 py-3 rounded-xl border border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4"
                    >
                        <div className="flex items-center gap-2">
                            <label htmlFor="products-per-page" className="text-xs text-gray-600">Per page:</label>
                            <select
                                id="products-per-page"
                                data-testid="products-per-page"
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
                            <span data-testid="products-page-info" className="text-xs text-gray-600 ml-2">
                                Page {page} of {Math.max(totalPages, 1)} ({total} total)
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                data-testid="products-prev"
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
                                data-testid="products-next"
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
                title="Delete Product"
            >
                <p className="text-sm text-gray-600">
                    Are you sure you want to delete{" "}
                    <span className="font-semibold text-gray-900">{deleteTarget?.name}</span>{" "}
                    (SKU <span className="font-mono">{deleteTarget?.sku}</span>)? Products with order
                    history cannot be deleted.
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
                        data-testid="product-delete-confirm"
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