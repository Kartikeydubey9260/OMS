import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiClientError } from "../api/client";
import { formatMoney } from "../utils/formatters";

interface CustomerOption {
    id: number;
    name: string;
    email: string;
}

interface ProductOption {
    id: number;
    name: string;
    sku: string;
    price: number | string;
    stock_quantity: number;
}

interface SelectedItem {
    product_id: number;
    sku: string;
    name: string;
    unit_price: number;
    quantity: number;
}

export const OrderWizardPage: React.FC = () => {
    const navigate = useNavigate();

    const [step, setStep] = useState(1);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);

    // Step 1: Customer
    const [customerSearch, setCustomerSearch] = useState("");
    const [customerResults, setCustomerResults] = useState<CustomerOption[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);

    // Step 2: Products
    const [productSearch, setProductSearch] = useState("");
    const [productResults, setProductResults] = useState<ProductOption[]>([]);
    const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);

    // Step 3: Pricing
    const [discountType, setDiscountType] = useState<"none" | "fixed" | "percentage">("none");
    const [discountValue, setDiscountValue] = useState<string>("0");
    const [previewTotal, setPreviewTotal] = useState<number>(0);

    // Step 4: Metadata
    const [priority, setPriority] = useState<string>("normal");
    const [assigneeId, setAssigneeId] = useState<string>("");
    const [staffList, setStaffList] = useState<{ id: number; name: string }[]>([]);
    const [status, setStatus] = useState<string>("pending");
    const [orderDate, setOrderDate] = useState<string>(
        new Date().toISOString().split("T")[0]
    );
    const [notes, setNotes] = useState<string>("");

    // Load assignable staff
    useEffect(() => {
        api.get("/users/assignable").then((res) => {
            setStaffList(res.data || []);
        }).catch(() => {});
    }, []);

    // Search customers
    useEffect(() => {
        if (!customerSearch.trim()) {
            setCustomerResults([]);
            return;
        }
        const timer = setTimeout(() => {
            api.get<CustomerOption[]>(`/customers/lookup?search=${encodeURIComponent(customerSearch.trim())}`)
                .then((res) => setCustomerResults(res.data || []))
                .catch(() => {});
        }, 200);
        return () => clearTimeout(timer);
    }, [customerSearch]);

    // Search products
    useEffect(() => {
        if (!productSearch.trim()) {
            setProductResults([]);
            return;
        }
        const timer = setTimeout(() => {
            api.get<ProductOption[]>(`/products/lookup?search=${encodeURIComponent(productSearch.trim())}`)
                .then((res) => setProductResults(res.data || []))
                .catch(() => {});
        }, 200);
        return () => clearTimeout(timer);
    }, [productSearch]);

    // Update server preview calculation
    useEffect(() => {
        if (selectedItems.length === 0) {
            setPreviewTotal(0);
            return;
        }

        const payload = {
            items: selectedItems.map((item) => ({
                product_id: item.product_id,
                quantity: item.quantity,
            })),
            discount_type: discountType,
            discount_value: parseFloat(discountValue) || 0,
        };

        api.post("/orders/preview", payload)
            .then((res) => {
                setPreviewTotal(Number(res.data?.total || 0));
            })
            .catch(() => {
                // Fallback client calculation if preview API fails
                const subtotal = selectedItems.reduce(
                    (acc, it) => acc + it.unit_price * it.quantity,
                    0
                );
                const disc = discountType === "percentage"
                    ? (subtotal * (parseFloat(discountValue) || 0)) / 100
                    : discountType === "fixed"
                    ? parseFloat(discountValue) || 0
                    : 0;
                const taxedSub = Math.max(0, subtotal - disc);
                const tax = taxedSub * 0.1;
                setPreviewTotal(taxedSub + tax);
            });
    }, [selectedItems, discountType, discountValue]);

    const handleSelectProduct = (product: ProductOption) => {
        setSelectedItems((prev) => {
            const existingIndex = prev.findIndex((p) => p.product_id === product.id);
            if (existingIndex >= 0) {
                const updated = [...prev];
                updated[existingIndex] = {
                    ...updated[existingIndex],
                    quantity: updated[existingIndex].quantity + 1,
                };
                return updated;
            }
            return [
                ...prev,
                {
                    product_id: product.id,
                    sku: product.sku,
                    name: product.name,
                    unit_price: Number(product.price),
                    quantity: 1,
                },
            ];
        });
        setProductSearch("");
        setProductResults([]);
    };

    const handleNext = () => {
        setFieldErrors({});

        if (step === 1) {
            if (!selectedCustomer) {
                setFieldErrors({ customer: "Customer is required." });
                return;
            }
            setStep(2);
            return;
        }

        if (step === 2) {
            if (selectedItems.length === 0) {
                setFieldErrors({ items: "Order must contain at least one product." });
                return;
            }
            const invalidQty = selectedItems.some((it) => it.quantity <= 0);
            if (invalidQty) {
                setFieldErrors({ items: "Quantity must be greater than 0." });
                return;
            }
            setStep(3);
            return;
        }

        if (step === 3) {
            setStep(4);
            return;
        }

        if (step === 4) {
            setStep(5);
            return;
        }
    };

    const handleBack = () => {
        setFieldErrors({});
        setStep((s) => Math.max(1, s - 1));
    };

    const handleSubmitOrder = async () => {
        if (!selectedCustomer) return;
        setSubmitting(true);
        setFieldErrors({});

        const payload: Record<string, unknown> = {
            customer_id: selectedCustomer.id,
            order_date: orderDate,
            priority,
            status,
            discount_type: discountType,
            discount_value: parseFloat(discountValue) || 0,
            notes: notes || undefined,
            items: selectedItems.map((item) => ({
                product_id: item.product_id,
                quantity: item.quantity,
            })),
        };

        if (assigneeId) {
            payload.assigned_to = parseInt(assigneeId, 10);
        }

        try {
            const res = await api.post<{ id: number }>("/orders", payload);
            navigate(`/orders/${res.data.id}`);
        } catch (err: unknown) {
            if (err instanceof ApiClientError && err.errors) {
                const errMap: Record<string, string> = {};
                Object.entries(err.errors).forEach(([k, v]) => {
                    errMap[k] = Array.isArray(v) ? v[0] : String(v);
                });
                setFieldErrors(errMap);
            } else {
                setFieldErrors({ general: err instanceof Error ? err.message : "Failed to create order." });
            }
            setSubmitting(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 overflow-x-hidden">
            <div className="border-b border-gray-200 pb-4">
                <h1 data-testid="page-title" className="text-3xl font-extrabold text-gray-900 tracking-tight">
                    Create New Order
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                    Step {step} of 5 — {step === 1 ? "Select Customer" : step === 2 ? "Add Products" : step === 3 ? "Pricing & Discount" : step === 4 ? "Assignment & Details" : "Review & Submit"}
                </p>
            </div>

            {/* Step 1: Customer Selection */}
            {step === 1 && (
                <div data-testid="wizard-step-1" className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
                    <h2 className="text-lg font-bold text-gray-900">Step 1: Customer Information</h2>

                    <div>
                        <label htmlFor="wizard-customer-search" className="block text-sm font-semibold text-gray-700 mb-1">
                            Search Customer
                        </label>
                        <input
                            id="wizard-customer-search"
                            type="text"
                            data-testid="wizard-customer-search"
                            placeholder="Type customer name or email..."
                            value={customerSearch}
                            onChange={(e) => setCustomerSearch(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[38px] text-gray-900"
                        />
                    </div>

                    {/* Customer search options */}
                    {customerResults.length > 0 && (
                        <div className="border border-gray-200 rounded-md divide-y divide-gray-100 max-h-48 overflow-y-auto">
                            {customerResults.map((c) => (
                                <div
                                    key={c.id}
                                    data-testid="wizard-customer-option"
                                    onClick={() => {
                                        setSelectedCustomer(c);
                                        setCustomerSearch(c.name);
                                        setCustomerResults([]);
                                        setFieldErrors({});
                                    }}
                                    className="p-3 text-sm cursor-pointer hover:bg-indigo-50 transition"
                                >
                                    <div className="font-semibold text-gray-900">{c.name}</div>
                                    <div className="text-xs text-gray-500">{c.email}</div>
                                </div>
                            ))}
                        </div>
                    )}

                    {selectedCustomer && (
                        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                            <span className="text-xs font-bold text-emerald-800 uppercase">Selected Customer:</span>
                            <div className="text-sm font-bold text-emerald-900">{selectedCustomer.name}</div>
                            <div className="text-xs text-emerald-700">{selectedCustomer.email}</div>
                        </div>
                    )}

                    {fieldErrors.customer && (
                        <p data-testid="field-error" className="text-sm text-red-600 font-semibold">
                            {fieldErrors.customer}
                        </p>
                    )}
                </div>
            )}

            {/* Step 2: Products */}
            {step === 2 && (
                <div data-testid="wizard-step-2" className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
                    <h2 className="text-lg font-bold text-gray-900">Step 2: Add Line Items</h2>

                    <div>
                        <label htmlFor="wizard-product-search" className="block text-sm font-semibold text-gray-700 mb-1">
                            Search Products
                        </label>
                        <input
                            id="wizard-product-search"
                            type="text"
                            data-testid="wizard-product-search"
                            placeholder="Type product SKU or name..."
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[38px] text-gray-900"
                        />
                    </div>

                    {/* Product search options */}
                    {productResults.length > 0 && (
                        <div className="border border-gray-200 rounded-md divide-y divide-gray-100 max-h-48 overflow-y-auto">
                            {productResults.map((p) => (
                                <div
                                    key={p.id}
                                    data-testid="wizard-product-option"
                                    onClick={() => handleSelectProduct(p)}
                                    className="p-3 text-sm cursor-pointer hover:bg-indigo-50 transition flex justify-between items-center"
                                >
                                    <div>
                                        <div className="font-semibold text-gray-900">{p.name}</div>
                                        <div className="text-xs text-gray-500">SKU: {p.sku} | In stock: {p.stock_quantity}</div>
                                    </div>
                                    <div className="font-bold text-indigo-600">{formatMoney(p.price)}</div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Selected items table */}
                    {selectedItems.length > 0 && (
                        <div className="border border-gray-200 rounded-md overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Product</th>
                                        <th scope="col" className="px-4 py-2 text-right text-xs font-semibold text-gray-600">Unit Price</th>
                                        <th scope="col" className="px-4 py-2 text-center text-xs font-semibold text-gray-600">Quantity</th>
                                        <th scope="col" className="px-4 py-2 text-right text-xs font-semibold text-gray-600">Subtotal</th>
                                        <th scope="col" className="px-4 py-2 text-right text-xs font-semibold text-gray-600">Remove</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {selectedItems.map((item, idx) => (
                                        <tr key={item.product_id}>
                                            <td className="px-4 py-2">
                                                <div className="font-medium text-gray-900">{item.name}</div>
                                                <div className="text-xs text-gray-500">{item.sku}</div>
                                            </td>
                                            <td className="px-4 py-2 text-right text-gray-700">{formatMoney(item.unit_price)}</td>
                                            <td className="px-4 py-2 text-center">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    data-testid={`wizard-qty-${idx}`}
                                                    value={item.quantity}
                                                    onChange={(e) => {
                                                        const val = parseInt(e.target.value, 10);
                                                        setSelectedItems((prev) => {
                                                            const copy = [...prev];
                                                            copy[idx] = { ...copy[idx], quantity: isNaN(val) ? 0 : val };
                                                            return copy;
                                                        });
                                                    }}
                                                    className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm"
                                                />
                                            </td>
                                            <td className="px-4 py-2 text-right font-semibold text-gray-900">
                                                {formatMoney(item.unit_price * item.quantity)}
                                            </td>
                                            <td className="px-4 py-2 text-right">
                                                <button
                                                    type="button"
                                                    data-testid={`wizard-remove-${idx}`}
                                                    onClick={() => {
                                                        setSelectedItems((prev) => prev.filter((_, i) => i !== idx));
                                                    }}
                                                    className="text-red-600 hover:text-red-800 text-xs font-semibold"
                                                >
                                                    Remove
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {fieldErrors.items && (
                        <p data-testid="field-error" className="text-sm text-red-600 font-semibold">
                            {fieldErrors.items}
                        </p>
                    )}
                </div>
            )}

            {/* Step 3: Pricing & Discount */}
            {step === 3 && (
                <div data-testid="wizard-step-3" className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
                    <h2 className="text-lg font-bold text-gray-900">Step 3: Pricing & Discounts</h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="wizard-discount-type" className="block text-sm font-semibold text-gray-700 mb-1">
                                Discount Type
                            </label>
                            <select
                                id="wizard-discount-type"
                                data-testid="wizard-discount-type"
                                value={discountType}
                                onChange={(e) => setDiscountType(e.target.value as "none" | "fixed" | "percentage")}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[38px] text-gray-900"
                            >
                                <option value="none">None</option>
                                <option value="fixed">Fixed Amount ($)</option>
                                <option value="percentage">Percentage (%)</option>
                            </select>
                        </div>

                        <div>
                            <label htmlFor="wizard-discount-value" className="block text-sm font-semibold text-gray-700 mb-1">
                                Discount Value
                            </label>
                            <input
                                id="wizard-discount-value"
                                type="number"
                                min="0"
                                step="any"
                                data-testid="wizard-discount-value"
                                value={discountValue}
                                onChange={(e) => setDiscountValue(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[38px] text-gray-900"
                            />
                        </div>
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center">
                        <span className="text-sm font-bold text-slate-700">Estimated Total (incl. 10% tax):</span>
                        <span data-testid="wizard-preview-total" className="text-2xl font-black text-indigo-700">
                            {formatMoney(previewTotal)}
                        </span>
                    </div>
                </div>
            )}

            {/* Step 4: Metadata & Assignment */}
            {step === 4 && (
                <div data-testid="wizard-step-4" className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
                    <h2 className="text-lg font-bold text-gray-900">Step 4: Priority & Assignment</h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="wizard-priority" className="block text-sm font-semibold text-gray-700 mb-1">
                                Priority
                            </label>
                            <select
                                id="wizard-priority"
                                data-testid="wizard-priority"
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

                        <div>
                            <label htmlFor="wizard-assignee" className="block text-sm font-semibold text-gray-700 mb-1">
                                Assign To Staff
                            </label>
                            <select
                                id="wizard-assignee"
                                data-testid="wizard-assignee"
                                value={assigneeId}
                                onChange={(e) => setAssigneeId(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[38px] text-gray-900"
                            >
                                <option value="">Unassigned</option>
                                {staffList.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label htmlFor="wizard-status" className="block text-sm font-semibold text-gray-700 mb-1">
                                Initial Status
                            </label>
                            <select
                                id="wizard-status"
                                data-testid="wizard-status"
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[38px] text-gray-900"
                            >
                                <option value="pending">Pending</option>
                                <option value="draft">Draft</option>
                            </select>
                        </div>

                        <div>
                            <label htmlFor="wizard-date" className="block text-sm font-semibold text-gray-700 mb-1">
                                Order Date
                            </label>
                            <input
                                id="wizard-date"
                                type="date"
                                data-testid="wizard-date"
                                value={orderDate}
                                onChange={(e) => setOrderDate(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[38px] text-gray-900"
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="wizard-notes" className="block text-sm font-semibold text-gray-700 mb-1">
                            Internal Order Notes
                        </label>
                        <textarea
                            id="wizard-notes"
                            rows={3}
                            data-testid="wizard-notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Add notes for fulfillment staff..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900"
                        />
                    </div>
                </div>
            )}

            {/* Step 5: Review & Submit */}
            {step === 5 && (
                <div data-testid="wizard-step-5" className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
                    <h2 className="text-lg font-bold text-gray-900">Step 5: Review Order</h2>

                    <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg p-4 space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-500">Customer:</span>
                            <span data-testid="wizard-review-customer" className="font-bold text-gray-900">
                                {selectedCustomer?.name} ({selectedCustomer?.email})
                            </span>
                        </div>
                        <div className="flex justify-between items-center pt-2">
                            <span className="text-sm text-gray-500">Items Count:</span>
                            <span className="font-semibold text-gray-900">{selectedItems.length} lines</span>
                        </div>
                        <div className="flex justify-between items-center pt-2">
                            <span className="text-sm text-gray-500">Priority / Status:</span>
                            <span className="font-semibold text-gray-900 capitalize">{priority} / {status}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2">
                            <span className="text-sm font-bold text-gray-700">Calculated Total:</span>
                            <span data-testid="wizard-review-total" className="text-2xl font-black text-indigo-700">
                                {formatMoney(previewTotal)}
                            </span>
                        </div>
                    </div>

                    {fieldErrors.general && (
                        <p data-testid="field-error" className="text-sm text-red-600 font-semibold">
                            {fieldErrors.general}
                        </p>
                    )}
                </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                {step > 1 ? (
                    <button
                        type="button"
                        data-testid="wizard-back"
                        onClick={handleBack}
                        className="px-4 py-2 border border-gray-300 rounded-md text-sm font-semibold text-gray-700 hover:bg-gray-50 min-h-[38px]"
                    >
                        Back
                    </button>
                ) : (
                    <div />
                )}

                {step < 5 ? (
                    <button
                        type="button"
                        data-testid="wizard-next"
                        onClick={handleNext}
                        className="px-5 py-2 bg-indigo-600 text-white rounded-md text-sm font-semibold hover:bg-indigo-700 min-h-[38px]"
                    >
                        Next Step
                    </button>
                ) : (
                    <button
                        type="button"
                        data-testid="wizard-submit"
                        disabled={submitting}
                        onClick={handleSubmitOrder}
                        className="px-6 py-2 bg-emerald-600 text-white rounded-md text-sm font-bold hover:bg-emerald-700 min-h-[38px] disabled:opacity-50"
                    >
                        {submitting ? "Submitting..." : "Submit Order"}
                    </button>
                )}
            </div>
        </div>
    );
};
