import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiClientError } from "../api/client";
import { toast } from "../components/ToastContainer";

export const ProductCreatePage: React.FC = () => {
    const navigate = useNavigate();

    const [name, setName] = useState("");
    const [sku, setSku] = useState("");
    const [price, setPrice] = useState("");
    const [stock, setStock] = useState("");
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFieldErrors({});

        // Client validation
        const localErrors: Record<string, string> = {};
        if (!name.trim()) localErrors.name = "Product name is required.";
        if (!sku.trim()) localErrors.sku = "Product SKU is required.";
        if (!price || parseFloat(price) < 0) localErrors.price = "Valid price is required.";
        if (!stock || parseInt(stock, 10) < 0) localErrors.stock_quantity = "Valid stock is required.";

        if (Object.keys(localErrors).length > 0) {
            setFieldErrors(localErrors);
            return;
        }

        setSubmitting(true);
        try {
            await api.post("/products", {
                name: name.trim(),
                sku: sku.trim(),
                price: parseFloat(price),
                stock_quantity: parseInt(stock, 10),
                status: "active",
            });
            toast.success("Product created successfully.");
            navigate("/products");
        } catch (err: unknown) {
            if (err instanceof ApiClientError && err.errors) {
                const errMap: Record<string, string> = {};
                Object.entries(err.errors).forEach(([k, v]) => {
                    errMap[k] = Array.isArray(v) ? v[0] : String(v);
                });
                setFieldErrors(errMap);
            } else {
                setFieldErrors({ general: err instanceof Error ? err.message : "Failed to create product." });
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="max-w-xl mx-auto px-4 py-8 space-y-6 overflow-x-hidden">
            <h1 data-testid="page-title" className="text-3xl font-extrabold text-gray-900 tracking-tight">
                Add New Product
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
                        onChange={(e) => setSku(e.target.value)}
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
                            Initial Stock <span className="text-red-500">*</span>
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
                        {submitting ? "Saving..." : "Save Product"}
                    </button>
                </div>
            </form>
        </div>
    );
};
