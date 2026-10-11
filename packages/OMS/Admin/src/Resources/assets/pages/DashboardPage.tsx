import React, { useState, useEffect, useRef, useCallback } from "react";
import { api, ApiClientError } from "../api/client";
import { getStoredAuth } from "../state/auth";
import { toast } from "../components/ToastContainer";
import { formatMoney, formatCount } from "../utils/formatters";

interface SummaryData {
    total_orders: number;
    pending_orders: number;
    confirmed_orders: number;
    processing_orders: number;
    ready_orders?: number;
    completed_orders: number;
    cancelled_orders: number;
    total_revenue: number;
    average_order_value: number;
    total_customers: number;
    total_products: number;
}

interface StatusDistributionItem {
    status: string;
    count: number;
}

interface RevenueTrendItem {
    label: string;
    revenue: number;
    orders?: number;
}

interface ReportTopItem {
    product_id?: number;
    product_name?: string;
    client_id?: number;
    client_name?: string;
    email?: string;
    sku?: string;
    orders_count: number;
    total_quantity?: number;
    total_revenue?: number;
    total_spent?: number;
}

interface PerClientItem {
    client_id: number;
    client_name: string;
    email: string;
    orders_count: number;
    total_quantity: number;
    avg_order_value: number;
    total_spent: number;
    latest_order_date: string | null;
}

interface PerProductItem {
    product_id: number;
    product_name: string;
    sku: string;
    orders_count: number;
    total_quantity_sold: number;
    total_revenue: number;
}

interface PaginationMeta {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
    from: number | null;
    to: number | null;
}

interface Paginated<T> {
    data: T[];
    meta: PaginationMeta;
}

interface ReportData {
    summary: {
        total_revenue: number;
        total_orders: number;
        total_customers: number;
        total_products: number;
        total_items_sold: number;
        average_order_value: number;
    };
    orders_by_status: { status: string; count: number; revenue: number }[];
    top_products_by_quantity: ReportTopItem[];
    top_products_by_price: ReportTopItem[];
    top_clients_by_orders: ReportTopItem[];
    top_clients_by_price: ReportTopItem[];
    per_client_report: Paginated<PerClientItem>;
    per_product_report: Paginated<PerProductItem>;
    filter_options: {
        years: string[];
        months: { value: string; name: string }[];
        statuses: string[];
        clients: { id: number; name: string; email: string }[];
        products: { id: number; name: string; sku: string }[];
    };
}

interface ReportFilters {
    year: string;
    month: string;
    status: string;
    startDate: string;
    endDate: string;
    customerId: string;
    productId: string;
}

const EMPTY_FILTERS: ReportFilters = {
    year: "",
    month: "",
    status: "",
    startDate: "",
    endDate: "",
    customerId: "",
    productId: "",
};

const EXPORT_TYPES: { value: string; label: string }[] = [
    { value: "overview", label: "Executive Overview" },
    { value: "top_products_by_quantity", label: "Top Products by Quantity" },
    { value: "top_products_by_price", label: "Top Products by Revenue" },
    { value: "top_clients_by_orders", label: "Top Clients by Orders" },
    { value: "top_clients_by_price", label: "Top Clients by Order Value" },
    { value: "per_client", label: "Per-Client Report" },
    { value: "per_product", label: "Per-Product Report" },
];

const chartBars = (items: ReportTopItem[], labelKey: string, valueKey: string) =>
    items.slice(0, 6).map((item) => {
        const label = (item as unknown as Record<string, unknown>)[labelKey] as string;
        const value = Number((item as unknown as Record<string, unknown>)[valueKey] || 0);
        return { label, value };
    });

export const DashboardPage: React.FC = () => {
    const [summary, setSummary] = useState<SummaryData | null>(null);
    const [distribution, setDistribution] = useState<StatusDistributionItem[]>([]);
    const [trend, setTrend] = useState<RevenueTrendItem[]>([]);
    const [period, setPeriod] = useState<"day" | "week" | "month">("day");

    // Report state
    const [filters, setFilters] = useState<ReportFilters>(EMPTY_FILTERS);
    const [detailView, setDetailView] = useState<"per_client" | "per_product">("per_client");
    const [detailPage, setDetailPage] = useState(1);
    const [detailPerPage, setDetailPerPage] = useState(10);
    const [clientSort, setClientSort] = useState("total_spent");
    const [productSort, setProductSort] = useState("total_revenue");
    const [detailOrder, setDetailOrder] = useState<"asc" | "desc">("desc");
    const [exportType, setExportType] = useState("per_client");
    const [report, setReport] = useState<ReportData | null>(null);
    const [reportLoading, setReportLoading] = useState(true);
    const [reportError, setReportError] = useState<string | null>(null);
    const [exporting, setExporting] = useState<string | null>(null);

    const fetchReportTimerRef = useRef<NodeJS.Timeout | null>(null);

    const fetchSummaryAndDist = async () => {
        try {
            const [sumRes, distRes] = await Promise.all([
                api.get<SummaryData>("/dashboard/summary"),
                api.get<StatusDistributionItem[]>("/dashboard/status-distribution"),
            ]);
            setSummary(sumRes.data);
            setDistribution(distRes.data || []);
        } catch {
            // Error handled
        }
    };

    const fetchTrend = async (p: "day" | "week" | "month") => {
        try {
            const res = await api.get<RevenueTrendItem[]>(`/dashboard/revenue-trend?period=${p}`);
            setTrend(res.data || []);
        } catch {
            // Error handled
        }
    };

    const buildReportQuery = useCallback((f: ReportFilters, top: number) => {
        const params = new URLSearchParams();
        params.append("top", String(top));
        if (f.year) params.append("year", f.year);
        if (f.month) params.append("month", f.month);
        if (f.status) params.append("status", f.status);
        if (f.startDate) params.append("start_date", f.startDate);
        if (f.endDate) params.append("end_date", f.endDate);
        if (f.customerId) params.append("customer_id", f.customerId);
        if (f.productId) params.append("product_id", f.productId);
        // Detailed breakdowns are server-driven, like every other table.
        params.append("page", String(detailPage));
        params.append("per_page", String(detailPerPage));
        params.append("sort", detailView === "per_client" ? clientSort : productSort);
        params.append("direction", detailOrder);
        return params.toString();
    }, [detailView, clientSort, productSort, detailOrder, detailPage, detailPerPage]);

    const fetchReport = useCallback(
        async (f: ReportFilters) => {
            setReportLoading(true);
            setReportError(null);
            try {
                const res = await api.get<ReportData>(`/dashboard/reports?${buildReportQuery(f, 10)}`);
                setReport(res.data);
            } catch (err: unknown) {
                setReportError(err instanceof ApiClientError ? err.message : "Unable to load reports.");
            } finally {
                setReportLoading(false);
            }
        },
        [buildReportQuery]
    );

    useEffect(() => {
        Promise.all([fetchSummaryAndDist(), fetchTrend("day")]);
        fetchReport(EMPTY_FILTERS);
    }, [fetchReport]);

    useEffect(() => {
        if (fetchReportTimerRef.current) clearTimeout(fetchReportTimerRef.current);
        fetchReportTimerRef.current = setTimeout(() => {
            fetchReport(filters);
        }, 400);
        return () => {
            if (fetchReportTimerRef.current) clearTimeout(fetchReportTimerRef.current);
        };
    }, [filters, fetchReport]);

    const handlePeriodChange = (newPeriod: "day" | "week" | "month") => {
        setPeriod(newPeriod);
        fetchTrend(newPeriod);
    };

    const setFilter = (key: keyof ReportFilters, value: string) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
        setDetailPage(1);
    };

    const resetFilters = () => {
        setFilters(EMPTY_FILTERS);
        setDetailPage(1);
    };

    const handleDetailViewChange = (view: "per_client" | "per_product") => {
        setDetailView(view);
        setDetailPage(1);
    };

    const handleDetailSort = (col: string) => {
        const active = detailView === "per_client" ? clientSort : productSort;
        if (active === col) {
            setDetailOrder((o) => (o === "asc" ? "desc" : "asc"));
        } else if (detailView === "per_client") {
            setClientSort(col);
            setDetailOrder("asc");
        } else {
            setProductSort(col);
            setDetailOrder("asc");
        }
        setDetailPage(1);
    };

    const detailSortMarker = (col: string) => {
        const active = detailView === "per_client" ? clientSort : productSort;
        return active === col ? (detailOrder === "asc" ? " ↑" : " ↓") : "";
    };

    const detailMeta: PaginationMeta =
        detailView === "per_client"
            ? report?.per_client_report.meta ?? {
                  current_page: 1,
                  per_page: detailPerPage,
                  total: 0,
                  last_page: 1,
                  from: null,
                  to: null,
              }
            : report?.per_product_report.meta ?? {
                  current_page: 1,
                  per_page: detailPerPage,
                  total: 0,
                  last_page: 1,
                  from: null,
                  to: null,
              };

    const downloadExport = async (format: string) => {
        setExporting(format);
        try {
            const auth = getStoredAuth();
            const params = new URLSearchParams();
            params.append("type", exportType);
            params.append("format", format);
            params.append("top", "10");
            if (filters.year) params.append("year", filters.year);
            if (filters.month) params.append("month", filters.month);
            if (filters.status) params.append("status", filters.status);
            if (filters.startDate) params.append("start_date", filters.startDate);
            if (filters.endDate) params.append("end_date", filters.endDate);
            if (filters.customerId) params.append("customer_id", filters.customerId);
            if (filters.productId) params.append("product_id", filters.productId);

            const res = await fetch(`/api/dashboard/reports/export?${params.toString()}`, {
                headers: {
                    Accept: "application/octet-stream",
                    ...(auth.token ? { Authorization: `Bearer ${auth.token}` } : {}),
                },
            });

            if (!res.ok) {
                const json = (await res.json().catch(() => null)) as { message?: string } | null;
                toast.error(json?.message || "Export failed.");
                return;
            }

            const blob = await res.blob();
            const disposition = res.headers.get("content-disposition") || "";
            const match = disposition.match(/filename=(?:"([^"]+)"|([^;]+))/i);
            const filename = match ? (match[1] || match[2]).trim() : `oms-report-${exportType}.${format}`;

            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            toast.success(`Exported report as ${format.toUpperCase()}.`);
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Export failed.");
        } finally {
            setExporting(null);
        }
    };

    const renderBarList = (
        items: ReportTopItem[],
        labelKey: string,
        valueKey: string,
        money: boolean,
        testid: string
    ) => {
        const bars = chartBars(items, labelKey, valueKey);
        const max = Math.max(...bars.map((b) => b.value), 1);
        return (
            <div data-testid={testid} className="w-full min-h-[220px] space-y-3 pt-2">
                {bars.length === 0 ? (
                    <div className="text-center text-xs text-gray-500 py-12">No data for this report view.</div>
                ) : (
                    bars.map((bar, idx) => (
                        <div key={idx} className="space-y-1">
                            <div className="flex items-center justify-between gap-2 text-xs">
                                <span className="font-semibold text-gray-700 truncate">{bar.label}</span>
                                <span className="text-gray-500 shrink-0">
                                    {money ? formatMoney(bar.value) : formatCount(bar.value)}
                                </span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                <div
                                    className="h-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
                                    style={{ width: `${Math.max((bar.value / max) * 100, 3)}%` }}
                                />
                            </div>
                        </div>
                    ))
                )}
            </div>
        );
    };

    const reportOptions = report?.filter_options;

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 overflow-x-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h1 data-testid="page-title" className="text-3xl font-extrabold text-gray-900 tracking-tight">
                    Dashboard Overview
                </h1>
                <div className="text-sm text-gray-500">Real-time Operations &amp; Analytics</div>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Orders</span>
                    <span data-testid="stat-total-orders" className="text-2xl font-bold text-gray-900 mt-2">
                        {summary ? formatCount(summary.total_orders) : "0"}
                    </span>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
                    <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Pending</span>
                    <span data-testid="stat-pending" className="text-2xl font-bold text-amber-700 mt-2">
                        {summary ? formatCount(summary.pending_orders) : "0"}
                    </span>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
                    <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Confirmed</span>
                    <span data-testid="stat-confirmed" className="text-2xl font-bold text-blue-700 mt-2">
                        {summary ? formatCount(summary.confirmed_orders) : "0"}
                    </span>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
                    <span className="text-xs font-semibold text-purple-600 uppercase tracking-wider">Processing</span>
                    <span data-testid="stat-processing" className="text-2xl font-bold text-purple-700 mt-2">
                        {summary ? formatCount(summary.processing_orders) : "0"}
                    </span>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
                    <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Completed</span>
                    <span data-testid="stat-completed" className="text-2xl font-bold text-emerald-700 mt-2">
                        {summary ? formatCount(summary.completed_orders) : "0"}
                    </span>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
                    <span className="text-xs font-semibold text-rose-600 uppercase tracking-wider">Cancelled</span>
                    <span data-testid="stat-cancelled" className="text-2xl font-bold text-rose-700 mt-2">
                        {summary ? formatCount(summary.cancelled_orders) : "0"}
                    </span>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Customers</span>
                    <span data-testid="stat-customers" className="text-2xl font-bold text-gray-900 mt-2">
                        {summary ? formatCount(summary.total_customers) : "0"}
                    </span>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Products</span>
                    <span data-testid="stat-products" className="text-2xl font-bold text-gray-900 mt-2">
                        {summary ? formatCount(summary.total_products) : "0"}
                    </span>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between md:col-span-2">
                    <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Total Revenue</span>
                    <span data-testid="stat-revenue" className="text-2xl font-bold text-indigo-700 mt-2">
                        {summary ? formatMoney(summary.total_revenue) : "$0.00"}
                    </span>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between md:col-span-2 lg:col-span-2">
                    <span className="text-xs font-semibold text-cyan-600 uppercase tracking-wider">Avg Order Value</span>
                    <span data-testid="stat-avg" className="text-2xl font-bold text-cyan-700 mt-2">
                        {summary ? formatMoney(summary.average_order_value) : "$0.00"}
                    </span>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Status Distribution */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h2 className="text-lg font-bold text-gray-900 mb-4">Orders Status Distribution</h2>
                    <div data-testid="chart-status" className="w-full min-h-[260px] flex flex-col justify-center">
                        <div className="space-y-3">
                            {distribution.map((item) => {
                                const total = summary?.total_orders || 1;
                                const pct = Math.round((item.count / total) * 100) || 0;
                                return (
                                    <div key={item.status} className="space-y-1">
                                        <div className="flex justify-between text-xs font-semibold">
                                            <span className="capitalize text-gray-700">{item.status}</span>
                                            <span className="text-gray-500">{formatCount(item.count)} ({pct}%)</span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                                            <div
                                                className={`h-3 rounded-full transition-all duration-500 ${
                                                    item.status === "completed"
                                                        ? "bg-emerald-500"
                                                        : item.status === "cancelled"
                                                        ? "bg-rose-500"
                                                        : item.status === "pending"
                                                        ? "bg-amber-500"
                                                        : item.status === "confirmed"
                                                        ? "bg-blue-500"
                                                        : "bg-purple-500"
                                                }`}
                                                style={{ width: `${Math.max(pct, 2)}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Revenue Trend */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                        <h2 className="text-lg font-bold text-gray-900">Revenue Trend</h2>
                        <div className="inline-flex rounded-md shadow-sm">
                            <button
                                type="button"
                                data-testid="revenue-period-day"
                                onClick={() => handlePeriodChange("day")}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-l-md border min-h-[36px] ${
                                    period === "day"
                                        ? "bg-indigo-600 text-white border-indigo-600"
                                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                                }`}
                            >
                                Day
                            </button>
                            <button
                                type="button"
                                data-testid="revenue-period-week"
                                onClick={() => handlePeriodChange("week")}
                                className={`px-3 py-1.5 text-xs font-semibold border-t border-b min-h-[36px] ${
                                    period === "week"
                                        ? "bg-indigo-600 text-white border-indigo-600"
                                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                                }`}
                            >
                                Week
                            </button>
                            <button
                                type="button"
                                data-testid="revenue-period-month"
                                onClick={() => handlePeriodChange("month")}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-r-md border min-h-[36px] ${
                                    period === "month"
                                        ? "bg-indigo-600 text-white border-indigo-600"
                                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                                }`}
                            >
                                Month
                            </button>
                        </div>
                    </div>

                    <div data-testid="chart-revenue" className="w-full h-[260px] flex items-end gap-2 pt-6">
                        {trend.length === 0 ? (
                            <div className="w-full text-center text-xs text-gray-500 py-12">No trend data available</div>
                        ) : (
                            trend.map((point, idx) => {
                                const maxRev = Math.max(...trend.map((t) => Number(t.revenue)), 1);
                                const heightPct = Math.round((Number(point.revenue) / maxRev) * 100);
                                return (
                                    <div key={idx} className="relative flex-1 min-w-0 h-full flex flex-col items-center gap-1 group">
                                        <div className="relative w-full flex-1 flex items-end justify-center min-h-0">
                                            <div
                                                className="relative w-full bg-indigo-500 hover:bg-indigo-600 rounded-t transition-all"
                                                style={{ height: `${Math.max(heightPct, 4)}%` }}
                                            >
                                                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 text-[10px] text-gray-500 opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none z-10 bg-white px-1 rounded shadow-sm">
                                                    {formatMoney(point.revenue)}
                                                    {typeof point.orders === "number" ? ` · ${point.orders} order${point.orders === 1 ? "" : "s"}` : ""}
                                                    {point.label ? ` · ${point.label}` : ""}
                                                </span>
                                            </div>
                                        </div>
                                        <span className="text-[10px] text-gray-500 truncate w-full text-center">
                                            {point.label}
                                        </span>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* ================= Reports Hub ================= */}
            <section data-testid="reports-section" aria-label="Reports and analytics" className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                    <div>
                        <h2 data-testid="reports-title" className="text-2xl font-extrabold text-gray-900 tracking-tight">
                            Reports &amp; Analytics
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            Top products, top clients and per-client / per-product breakdowns. All reports are
                            filterable and exportable.
                        </p>
                    </div>
                    {reportLoading && (
                        <span data-testid="reports-loading" className="text-xs text-indigo-600 font-semibold">
                            Updating reports...
                        </span>
                    )}
                </div>

                {/* Filters */}
                <div
                    data-testid="reports-filters"
                    className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3"
                >
                    <div>
                        <label htmlFor="reports-filter-year" className="block text-xs font-semibold text-gray-500 mb-1">
                            Year
                        </label>
                        <select
                            id="reports-filter-year"
                            data-testid="reports-filter-year"
                            value={filters.year}
                            onChange={(e) => setFilter("year", e.target.value)}
                            className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm min-h-[38px] text-gray-900"
                        >
                            <option value="">All Years</option>
                            {(reportOptions?.years || []).map((y) => (
                                <option key={y} value={y}>
                                    {y}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="reports-filter-month" className="block text-xs font-semibold text-gray-500 mb-1">
                            Month
                        </label>
                        <select
                            id="reports-filter-month"
                            data-testid="reports-filter-month"
                            value={filters.month}
                            onChange={(e) => setFilter("month", e.target.value)}
                            className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm min-h-[38px] text-gray-900"
                        >
                            <option value="">All Months</option>
                            {(reportOptions?.months || []).map((m) => (
                                <option key={m.value} value={m.value}>
                                    {m.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="reports-filter-status" className="block text-xs font-semibold text-gray-500 mb-1">
                            Status
                        </label>
                        <select
                            id="reports-filter-status"
                            data-testid="reports-filter-status"
                            value={filters.status}
                            onChange={(e) => setFilter("status", e.target.value)}
                            className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm min-h-[38px] text-gray-900"
                        >
                            <option value="">All Statuses</option>
                            {(reportOptions?.statuses || []).map((s) => (
                                <option key={s} value={s}>
                                    {s}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="reports-filter-client" className="block text-xs font-semibold text-gray-500 mb-1">
                            Client
                        </label>
                        <select
                            id="reports-filter-client"
                            data-testid="reports-filter-client"
                            value={filters.customerId}
                            onChange={(e) => setFilter("customerId", e.target.value)}
                            className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm min-h-[38px] text-gray-900"
                        >
                            <option value="">All Clients</option>
                            {(reportOptions?.clients || []).map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="reports-filter-product" className="block text-xs font-semibold text-gray-500 mb-1">
                            Product
                        </label>
                        <select
                            id="reports-filter-product"
                            data-testid="reports-filter-product"
                            value={filters.productId}
                            onChange={(e) => setFilter("productId", e.target.value)}
                            className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm min-h-[38px] text-gray-900"
                        >
                            <option value="">All Products</option>
                            {(reportOptions?.products || []).map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.name} ({p.sku})
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="reports-filter-start" className="block text-xs font-semibold text-gray-500 mb-1">
                            From
                        </label>
                        <input
                            id="reports-filter-start"
                            type="date"
                            data-testid="reports-filter-start"
                            value={filters.startDate}
                            onChange={(e) => setFilter("startDate", e.target.value)}
                            className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm min-h-[38px] text-gray-900"
                        />
                    </div>
                    <div>
                        <label htmlFor="reports-filter-end" className="block text-xs font-semibold text-gray-500 mb-1">
                            To
                        </label>
                        <input
                            id="reports-filter-end"
                            type="date"
                            data-testid="reports-filter-end"
                            value={filters.endDate}
                            onChange={(e) => setFilter("endDate", e.target.value)}
                            className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm min-h-[38px] text-gray-900"
                        />
                    </div>
                    <div className="flex items-end">
                        <button
                            type="button"
                            data-testid="reports-reset"
                            onClick={resetFilters}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-semibold text-gray-700 hover:bg-gray-50 min-h-[38px]"
                        >
                            Reset
                        </button>
                    </div>
                </div>

                {reportError && (
                    <div
                        data-testid="reports-error"
                        role="alert"
                        className="p-4 rounded-md bg-red-50 border border-red-200 text-red-700 flex items-center justify-between"
                    >
                        <div>
                            <span className="font-bold">Error:</span> {reportError}
                        </div>
                        <button
                            type="button"
                            onClick={() => fetchReport(filters)}
                            className="px-3 py-1.5 bg-red-600 text-white rounded text-xs font-semibold hover:bg-red-700 min-h-[36px]"
                        >
                            Retry
                        </button>
                    </div>
                )}

                {/* Report KPI summary strip */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Report Revenue</span>
                        <span data-testid="report-stat-revenue" className="block text-xl font-bold text-indigo-700 mt-1">
                            {report ? formatMoney(report.summary.total_revenue) : "$0.00"}
                        </span>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Orders</span>
                        <span data-testid="report-stat-orders" className="block text-xl font-bold text-gray-900 mt-1">
                            {report ? formatCount(report.summary.total_orders) : "0"}
                        </span>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Items Sold</span>
                        <span data-testid="report-stat-items" className="block text-xl font-bold text-gray-900 mt-1">
                            {report ? formatCount(report.summary.total_items_sold) : "0"}
                        </span>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Avg Order Value</span>
                        <span data-testid="report-stat-avg" className="block text-xl font-bold text-cyan-700 mt-1">
                            {report ? formatMoney(report.summary.average_order_value) : "$0.00"}
                        </span>
                    </div>
                </div>

                {/* Top lists */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Top Products by Quantity Sold</h3>
                        <p className="text-xs text-gray-500 mb-3">Units sold per product (filtered)</p>
                        {report ? (
                            renderBarList(report.top_products_by_quantity, "product_name", "total_quantity", false, "report-top-products-qty")
                        ) : (
                            <div data-testid="report-top-products-qty" className="h-[200px] bg-gray-50 rounded animate-pulse" />
                        )}
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Top Products by Revenue</h3>
                        <p className="text-xs text-gray-500 mb-3">Revenue generated per product (filtered)</p>
                        {report ? (
                            renderBarList(report.top_products_by_price, "product_name", "total_revenue", true, "report-top-products-price")
                        ) : (
                            <div data-testid="report-top-products-price" className="h-[200px] bg-gray-50 rounded animate-pulse" />
                        )}
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Top Clients by Order Count</h3>
                        <p className="text-xs text-gray-500 mb-3">Number of orders per client (filtered)</p>
                        {report ? (
                            renderBarList(report.top_clients_by_orders, "client_name", "orders_count", false, "report-top-clients-orders")
                        ) : (
                            <div data-testid="report-top-clients-orders" className="h-[200px] bg-gray-50 rounded animate-pulse" />
                        )}
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Top Clients by Order Value</h3>
                        <p className="text-xs text-gray-500 mb-3">Total spend per client (filtered)</p>
                        {report ? (
                            renderBarList(report.top_clients_by_price, "client_name", "total_spent", true, "report-top-clients-price")
                        ) : (
                            <div data-testid="report-top-clients-price" className="h-[200px] bg-gray-50 rounded animate-pulse" />
                        )}
                    </div>
                </div>

                {/* Per-client / per-product detail report */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 pt-6 pb-3">
                        <h3 className="text-lg font-bold text-gray-900">Detailed Breakdown</h3>
                        <div className="inline-flex rounded-md shadow-sm">
                            <button
                                type="button"
                                data-testid="reports-detail-per-client"
                                onClick={() => handleDetailViewChange("per_client")}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-l-md border min-h-[36px] ${
                                    detailView === "per_client"
                                        ? "bg-indigo-600 text-white border-indigo-600"
                                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                                }`}
                            >
                                Per Client
                            </button>
                            <button
                                type="button"
                                data-testid="reports-detail-per-product"
                                onClick={() => handleDetailViewChange("per_product")}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-r-md border min-h-[36px] ${
                                    detailView === "per_product"
                                        ? "bg-indigo-600 text-white border-indigo-600"
                                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                                }`}
                            >
                                Per Product
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto px-1">
                        {detailView === "per_client" ? (
                            <table data-testid="reports-detail-table" className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        {[
                                            { col: "client_name", label: "Client", cls: "text-left" },
                                            { col: "orders_count", label: "Orders", cls: "text-center" },
                                            { col: "total_quantity", label: "Units", cls: "text-center" },
                                            { col: "avg_order_value", label: "Avg Order", cls: "text-right" },
                                            { col: "total_spent", label: "Total Spent", cls: "text-right" },
                                            { col: "latest_order_date", label: "Latest Order", cls: "text-left" },
                                        ].map((h) => (
                                            <th key={h.col} className={`px-6 py-3 ${h.cls} text-xs font-bold text-gray-600 uppercase tracking-wider`}>
                                                <button
                                                    type="button"
                                                    data-testid={`reports-detail-sort-${h.col}`}
                                                    onClick={() => handleDetailSort(h.col)}
                                                    className="inline-flex items-center gap-1 hover:text-indigo-600"
                                                >
                                                    {h.label}
                                                    {detailSortMarker(h.col)}
                                                </button>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-100 text-sm">
                                    {(report?.per_client_report.data || []).length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                                No client data for the selected filters.
                                            </td>
                                        </tr>
                                    ) : (
                                        report?.per_client_report.data.map((row) => (
                                            <tr key={row.client_id} data-testid="reports-detail-row" className="hover:bg-slate-50">
                                                <td className="px-6 py-3 whitespace-nowrap font-semibold text-gray-900">{row.client_name}</td>
                                                <td className="px-6 py-3 whitespace-nowrap text-center text-gray-700">{formatCount(row.orders_count)}</td>
                                                <td className="px-6 py-3 whitespace-nowrap text-center text-gray-700">{formatCount(row.total_quantity)}</td>
                                                <td className="px-6 py-3 whitespace-nowrap text-right text-gray-700">{formatMoney(row.avg_order_value)}</td>
                                                <td className="px-6 py-3 whitespace-nowrap text-right font-bold text-indigo-700">{formatMoney(row.total_spent)}</td>
                                                <td className="px-6 py-3 whitespace-nowrap text-gray-500">
                                                    {row.latest_order_date ? new Date(row.latest_order_date).toLocaleDateString("en-US") : "—"}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        ) : (
                            <table data-testid="reports-detail-table" className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        {[
                                            { col: "product_name", label: "Product", cls: "text-left" },
                                            { col: "sku", label: "SKU", cls: "text-left" },
                                            { col: "orders_count", label: "Orders", cls: "text-center" },
                                            { col: "total_quantity_sold", label: "Units Sold", cls: "text-center" },
                                            { col: "total_revenue", label: "Revenue", cls: "text-right" },
                                        ].map((h) => (
                                            <th key={h.col} className={`px-6 py-3 ${h.cls} text-xs font-bold text-gray-600 uppercase tracking-wider`}>
                                                <button
                                                    type="button"
                                                    data-testid={`reports-detail-sort-${h.col}`}
                                                    onClick={() => handleDetailSort(h.col)}
                                                    className="inline-flex items-center gap-1 hover:text-indigo-600"
                                                >
                                                    {h.label}
                                                    {detailSortMarker(h.col)}
                                                </button>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-100 text-sm">
                                    {(report?.per_product_report.data || []).length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                                No product data for the selected filters.
                                            </td>
                                        </tr>
                                    ) : (
                                        report?.per_product_report.data.map((row) => (
                                            <tr key={row.product_id} data-testid="reports-detail-row" className="hover:bg-slate-50">
                                                <td className="px-6 py-3 whitespace-nowrap font-semibold text-gray-900">{row.product_name}</td>
                                                <td className="px-6 py-3 whitespace-nowrap font-mono text-xs text-indigo-600">{row.sku}</td>
                                                <td className="px-6 py-3 whitespace-nowrap text-center text-gray-700">{formatCount(row.orders_count)}</td>
                                                <td className="px-6 py-3 whitespace-nowrap text-center text-gray-700">{formatCount(row.total_quantity_sold)}</td>
                                                <td className="px-6 py-3 whitespace-nowrap text-right font-bold text-indigo-700">{formatMoney(row.total_revenue)}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>

                    <div
                        data-testid="reports-detail-pagination"
                        className="px-6 py-3 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3"
                    >
                        <div className="flex items-center gap-2">
                            <label htmlFor="reports-detail-per-page" className="text-xs text-gray-600">Per page:</label>
                            <select
                                id="reports-detail-per-page"
                                data-testid="reports-detail-per-page"
                                value={detailPerPage}
                                onChange={(e) => {
                                    setDetailPerPage(parseInt(e.target.value, 10));
                                    setDetailPage(1);
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
                            <span data-testid="reports-detail-page-info" className="text-xs text-gray-600 ml-2">
                                Page {detailMeta.current_page} of {Math.max(detailMeta.last_page, 1)} ({detailMeta.total} total)
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                data-testid="reports-detail-prev"
                                disabled={detailMeta.current_page <= 1}
                                onClick={() => setDetailPage(Math.max(1, detailMeta.current_page - 1))}
                                className="px-3 py-1.5 border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed min-h-[36px]"
                            >
                                Previous
                            </button>
                            <button
                                type="button"
                                data-testid="reports-detail-next"
                                disabled={detailMeta.current_page >= detailMeta.last_page}
                                onClick={() => setDetailPage(Math.min(detailMeta.last_page, detailMeta.current_page + 1))}
                                className="px-3 py-1.5 border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed min-h-[36px]"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>

                {/* Export card */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div className="max-w-sm w-full">
                            <label htmlFor="reports-export-type" className="block text-sm font-semibold text-gray-700 mb-1">
                                Report to Export
                            </label>
                            <select
                                id="reports-export-type"
                                data-testid="reports-export-type"
                                value={exportType}
                                onChange={(e) => setExportType(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[38px] text-gray-900"
                            >
                                {EXPORT_TYPES.map((t) => (
                                    <option key={t.value} value={t.value}>
                                        {t.label}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-gray-400 mt-2">
                                Exports honor the filters applied above.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {[
                                { format: "csv", label: "CSV", testid: "reports-export-csv" },
                                { format: "xls", label: "XLS", testid: "reports-export-xls" },
                                { format: "xlsx", label: "XLSX", testid: "reports-export-xlsx" },
                                { format: "pdf", label: "PDF", testid: "reports-export-pdf" },
                            ].map((btn) => (
                                <button
                                    key={btn.format}
                                    type="button"
                                    data-testid={btn.testid}
                                    disabled={exporting !== null}
                                    onClick={() => downloadExport(btn.format)}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 min-h-[38px]"
                                >
                                    {exporting === btn.format ? "Exporting..." : `Export ${btn.label}`}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};