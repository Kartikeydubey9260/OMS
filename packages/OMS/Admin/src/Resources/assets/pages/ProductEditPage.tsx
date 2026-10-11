import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, ApiClientError } from "../api/client";
import { toast } from "../components/ToastContainer";

export const ProductEditPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [name, setName] = useState("");
    const [sku, setSku] = useState("");
    const [price, setPrice] = useState("");
    const [stock, setStock] = useState("");
    const [threshold, setThreshold] = useState("");
    const [status, setStatus] = useState("active");
    const [description, setDescription] = useState("");
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!id) return;
        api.get(`/products/${id}`)
            .then((res) => {
                const p = res.data;
                setName(p.name || "");
                setSku(p.sku || "");
                setPrice(p.price !== undefined && p.price !== null ? String(p.price) : "");
                setStock(p.stock_quantity !== undefined && p.stock_quantity !== null ? String(p.stock_quantity) : "0");
                setThreshold(
                    p.low_stock_threshold !== undefined && p.low_stock_threshold !== null
                        ? String(p.low_stock_threshold)
                        : "5"
                );
                setStatus(p.status || "active");
                setDescription(p.description || "");
            })
            .catch((err: unknown) => {
                if (err instanceof ApiClientError && err.status === 404) {
                    setNotFound(true);
                }
            })
            .finally(() => setLoading(false));
    }, [id]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFieldErrors({});

        const localErrors: Record<string, string> = {};
        if (!name.trim()) localErrors.name = "Product name is required.";
        if (!sku.trim()) localErrors.sku = "Product SKU is required.";
        if (price === "" || parseFloat(price) < 0) localErrors.price = "Valid price is required.";
        if (stock === "" || parseInt(stock, 10) < 0) localErrors.stock_quantity = "Valid stock is required.";

        if (Object.keys(localErrors).length > 0) {
            setFieldErrors(localErrors);
            return;
        }

        setSubmitting(true);
        try {
            const res = await api.put(`/products/${id}`, {
                name: name.trim(),
                sku: sku.trim(),
                price: parseFloat(price),
                stock_quantity: parseInt(stock, 10),
                status,
                low_stock_threshold: threshold !== "" ? parseInt(threshold, 10) : 0,
                description: description.trim() || null,
            });
            toast.success("Product updated successfully.");
            navigate("/products", { state: { updated: res.data.id } });
        } catch (err: unknown) {
            if (err instanceof ApiClientError && err.errors) {
                const errMap: Record<string, string> = {};
                Object.entries(err.errors).forEach(([k, v]) => {
                    errMap[k] = Array.isArray(v) ? v[0] : String(v);
                });
                setFieldErrors(errMap);
            } else {
                setFieldErrors({ general: err instanceof Error ? err.message : "Failed to update product." });
            }
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
                <div className="h-8 bg-gray-200 rounded w-1/3 animate-pulse" />
                <div className="h-72 bg-gray-100 rounded-xl animate-pulse" />
            </div>
        );
    }

    if (notFound) {
        return (
            <div className="max-w-xl mx-auto px-4 py-8 text-center text-gray-500">
                Product not found.
            </div>
        );
    }

    return (
        <div className="max-w-xl mx-auto px-4 py-8 space-y-6 overflow-x-hidden">
            <h1 data-testid="page-title" className="text-3xl font-extrabold text-gray-900 tracking-tight">
                Edit Product
            </h1>

            <form onSubmit={handleSubmit} noValidate className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
                {fieldErrors.general && (
                    <div data-testid="field-error" className="p-3 bg-red-50 text-red-700 rounded-md text-sm font-semibold">
                        {fieldErrors.general}
                    </div>
                )}

                <div>
                    <label htmlFor="product-name" className="block text-sm font-semibold text-gray-700 mb-1">
                        Product Name <span className="text-red-500">*</span>
                    </label>
                    <input
                        id="product-name"
                        type="text"
                        data-testid="product-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        aria-invalid={!!fieldErrors.name}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[38px] text-gray-900"
                    />
                    {fieldErrors.name && (
                        <p data-testid="field-error" className="text-xs text-red-600 font-semibold mt-1">
                            {fieldErrors.name}
                        </p>
                    )}
                </div>

                <div>
                    <label htmlFor="product-sku" className="block text-sm font-semibold text-gray-700 mb-1">
                        SKU (Stock Keeping Unit) <span className="text-red-500">*</span>
                    </label>
                    <input
                        id="product-sku"
                        type="text"
                        data-testid="product-sku"
                        value={sku}
                        onChange={(e) => setSku(e.target.value.toUpperCase())}
                        aria-invalid={!!fieldErrors.sku}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[38px] text-gray-900 uppercase"
                    />
                    {fieldErrors.sku && (
                        <p data-testid="field-error" className="text-xs text-red-600 font-semibold mt-1">
                            {fieldErrors.sku}
                        </p>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="product-price" className="block text-sm font-semibold text-gray-700 mb-1">
                            Price ($) <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="product-price"
                            type="number"
                            step="0.01"
                            min="0"
                            data-testid="product-price"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            aria-invalid={!!fieldErrors.price}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[38px] text-gray-900"
                        />
                        {fieldErrors.price && (
                            <p data-testid="field-error" className="text-xs text-red-600 font-semibold mt-1">
                                {fieldErrors.price}
                            </p>
                        )}
                    </div>

                    <div>
                        <label htmlFor="product-stock" className="block text-sm font-semibold text-gray-700 mb-1">
                            Current Stock <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="product-stock"
                            type="number"
                            min="0"
                            data-testid="product-stock"
                            value={stock}
                            onChange={(e) => setStock(e.target.value)}
                            aria-invalid={!!fieldErrors.stock_quantity}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[38px] text-gray-900"
                        />
                        {fieldErrors.stock_quantity && (
                            <p data-testid="field-error" className="text-xs text-red-600 font-semibold mt-1">
                                {fieldErrors.stock_quantity}
                            </p>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="product-low-stock" className="block text-sm font-semibold text-gray-700 mb-1">
                            Low Stock Threshold
                        </label>
                        <input
                            id="product-low-stock"
                            type="number"
                            min="0"
                            data-testid="product-low-stock"
                            value={threshold}
                            onChange={(e) => setThreshold(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[38px] text-gray-900"
                        />
                    </div>

                    <div>
                        <label htmlFor="product-status" className="block text-sm font-semibold text-gray-700 mb-1">
                            Status
                        </label>
                        <select
                            id="product-status"
                            data-testid="product-status"
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[38px] text-gray-900"
                        >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label htmlFor="product-description" className="block text-sm font-semibold text-gray-700 mb-1">
                        Description
                    </label>
                    <textarea
                        id="product-description"
                        data-testid="product-description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[76px] text-gray-900"
                    />
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                    <button
                        type="button"
                        onClick={() => navigate("/products")}
                        className="px-4 py-2 border border-gray-300 rounded-md text-sm font-semibold text-gray-700 hover:bg-gray-50 min-h-[38px]"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        data-testid="product-submit"
                        disabled={submitting}
                        className="px-5 py-2 bg-indigo-600 text-white rounded-md text-sm font-semibold hover:bg-indigo-700 min-h-[38px] disabled:opacity-50"
                    >
                        {submitting ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            </form>
        </div>
    );
};