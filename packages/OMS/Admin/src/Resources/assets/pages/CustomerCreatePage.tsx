import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiClientError } from "../api/client";
import { toast } from "../components/ToastContainer";

export const CustomerCreatePage: React.FC = () => {
    const navigate = useNavigate();

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFieldErrors({});

        // Client validation
        const localErrors: Record<string, string> = {};
        if (!name.trim()) localErrors.name = "Customer name is required.";
        if (!email.trim()) localErrors.email = "Customer email is required.";

        if (Object.keys(localErrors).length > 0) {
            setFieldErrors(localErrors);
            return;
        }

        setSubmitting(true);
        try {
            const res = await api.post("/customers", {
                name: name.trim(),
                email: email.trim(),
                phone: phone.trim() || undefined,
            });
            toast.success("Customer created successfully.");
            navigate(`/customers/${res.data.id}`);
        } catch (err: unknown) {
            if (err instanceof ApiClientError && err.errors) {
                const errMap: Record<string, string> = {};
                Object.entries(err.errors).forEach(([k, v]) => {
                    errMap[k] = Array.isArray(v) ? v[0] : String(v);
                });
                setFieldErrors(errMap);
            } else {
                setFieldErrors({ general: err instanceof Error ? err.message : "Failed to create customer." });
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="max-w-xl mx-auto px-4 py-8 space-y-6 overflow-x-hidden">
            <h1 data-testid="page-title" className="text-3xl font-extrabold text-gray-900 tracking-tight">
                Create New Customer
            </h1>

            <form onSubmit={handleSubmit} noValidate className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
                {fieldErrors.general && (
                    <div data-testid="field-error" className="p-3 bg-red-50 text-red-700 rounded-md text-sm font-semibold">
                        {fieldErrors.general}
                    </div>
                )}

                <div>
                    <label htmlFor="customer-name" className="block text-sm font-semibold text-gray-700 mb-1">
                        Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                        id="customer-name"
                        type="text"
                        data-testid="customer-name"
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
                    <label htmlFor="customer-email" className="block text-sm font-semibold text-gray-700 mb-1">
                        Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                        id="customer-email"
                        type="email"
                        data-testid="customer-email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        aria-invalid={!!fieldErrors.email}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[38px] text-gray-900"
                    />
                    {fieldErrors.email && (
                        <p data-testid="field-error" className="text-xs text-red-600 font-semibold mt-1">
                            {fieldErrors.email}
                        </p>
                    )}
                </div>

                <div>
                    <label htmlFor="customer-phone" className="block text-sm font-semibold text-gray-700 mb-1">
                        Phone Number
                    </label>
                    <input
                        id="customer-phone"
                        type="text"
                        data-testid="customer-phone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[38px] text-gray-900"
                    />
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                    <button
                        type="button"
                        onClick={() => navigate("/customers")}
                        className="px-4 py-2 border border-gray-300 rounded-md text-sm font-semibold text-gray-700 hover:bg-gray-50 min-h-[38px]"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        data-testid="customer-submit"
                        disabled={submitting}
                        className="px-5 py-2 bg-indigo-600 text-white rounded-md text-sm font-semibold hover:bg-indigo-700 min-h-[38px] disabled:opacity-50"
                    >
                        {submitting ? "Creating..." : "Save Customer"}
                    </button>
                </div>
            </form>
        </div>
    );
};
