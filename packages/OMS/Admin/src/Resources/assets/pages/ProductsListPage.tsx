import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../state/auth";
import { api } from "../api/client";
import { formatMoney } from "../utils/formatters";

interface Product {
    id: number;
    name: string;
    sku: string;
    price: number | string;
    stock_quantity: number;
    status: string;
    created_at: string;
}

export const ProductsListPage: React.FC = () => {
    const { hasRole } = useAuth();
    // Only admin can create products per assessment RBAC
    const canCreate = hasRole(["admin", "super-admin"]);

    const [search, setSearch] = useState("");
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchProducts = async (query = "") => {
        setLoading(true);
        try {
            const url = query.trim()
                ? `/products?search=${encodeURIComponent(query.trim())}`
                : "/products";
            const res = await api.get(url);
            setProducts(res.data || []);
        } catch {
            // Error handled
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchProducts(search);
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 overflow-x-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h1 data-testid="page-title" className="text-3xl font-extrabold text-gray-900 tracking-tight">
                    Product Catalog
                </h1>
                {canCreate && (
                    <Link
                        to="/products/new"
                        data-testid="product-new"
                        className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-semibold hover:bg-indigo-700 min-h-[38px]"
                    >
                        + New Product
                    </Link>
                )}
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <label htmlFor="products-search" className="block text-xs font-semibold text-gray-500 mb-1">
                    Search Catalog
                </label>
                <input
                    id="products-search"
                    type="text"
                    data-testid="products-search"
                    placeholder="Search by SKU or product name..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[38px] text-gray-900"
                />
            </div>

            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
                    ))}
                </div>
            ) : products.length === 0 ? (
                <div className="p-12 text-center text-gray-500 bg-white rounded-xl border border-gray-100">
                    No products found.
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left">SKU</th>
                                <th scope="col" className="px-6 py-3 text-left">Product Name</th>
                                <th scope="col" className="px-6 py-3 text-right">Price</th>
                                <th scope="col" className="px-6 py-3 text-center">Stock</th>
                                <th scope="col" className="px-6 py-3 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {products.map((p) => (
                                <tr key={p.id} data-testid="product-row" className="hover:bg-slate-50 transition">
                                    <td className="px-6 py-4 font-mono text-xs font-bold text-indigo-600">
                                        {p.sku}
                                    </td>
                                    <td className="px-6 py-4 font-semibold text-gray-900">{p.name}</td>
                                    <td className="px-6 py-4 text-right font-bold text-gray-900">
                                        {formatMoney(p.price)}
                                    </td>
                                    <td className="px-6 py-4 text-center font-semibold text-gray-700">
                                        {p.stock_quantity}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span
                                            className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                                                p.status === "active"
                                                    ? "bg-emerald-100 text-emerald-800"
                                                    : "bg-gray-100 text-gray-800"
                                            }`}
                                        >
                                            {p.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};
