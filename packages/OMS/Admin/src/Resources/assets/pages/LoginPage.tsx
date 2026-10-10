import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../state/auth";
import { api, ApiClientError } from "../api/client";

export const LoginPage: React.FC = () => {
    const navigate = useNavigate();
    const { setAuth } = useAuth();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrors({});

        // Client-side validation: must show field-error without calling API if empty
        const newErrors: { email?: string; password?: string } = {};
        if (!email.trim()) {
            newErrors.email = "Email is required.";
        }
        if (!password) {
            newErrors.password = "Password is required.";
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setLoading(true);
        try {
            const res = await api.post("/login", { email, password });
            const { token, user } = res.data;
            setAuth(token, user);

            if (user.role === "staff") {
                navigate("/orders");
            } else {
                navigate("/dashboard");
            }
        } catch (err: unknown) {
            if (err instanceof ApiClientError && (err.status === 401 || err.code === "INVALID_CREDENTIALS")) {
                setErrors({ general: err.message || "Invalid credentials." });
            } else {
                setErrors({ general: err instanceof Error ? err.message : "An error occurred during login." });
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 px-4 overflow-x-hidden">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="flex justify-center">
                    <span className="bg-indigo-600 text-white font-black px-3 py-1 rounded text-xl shadow-lg">
                        OMS
                    </span>
                </div>
                <h1
                    data-testid="page-title"
                    className="mt-6 text-center text-3xl font-extrabold text-white"
                >
                    Sign in to your account
                </h1>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow-xl sm:rounded-lg sm:px-10">
                    {errors.general && (
                        <div
                            data-testid="login-error"
                            role="alert"
                            className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm font-medium"
                        >
                            {errors.general}
                        </div>
                    )}

                    <form className="space-y-6" onSubmit={handleSubmit} noValidate>
                        <div>
                            <label
                                htmlFor="email"
                                className="block text-sm font-medium text-gray-700"
                            >
                                Email address
                            </label>
                            <div className="mt-1">
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    data-testid="login-email"
                                    aria-invalid={!!errors.email}
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900 min-h-[38px]"
                                />
                                {errors.email && (
                                    <p
                                        data-testid="field-error"
                                        className="mt-1 text-sm text-red-600 font-medium"
                                    >
                                        {errors.email}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div>
                            <label
                                htmlFor="password"
                                className="block text-sm font-medium text-gray-700"
                            >
                                Password
                            </label>
                            <div className="mt-1">
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    autoComplete="current-password"
                                    data-testid="login-password"
                                    aria-invalid={!!errors.password}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900 min-h-[38px]"
                                />
                                {errors.password && (
                                    <p
                                        data-testid="field-error"
                                        className="mt-1 text-sm text-red-600 font-medium"
                                    >
                                        {errors.password}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                data-testid="login-submit"
                                disabled={loading}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 min-h-[38px]"
                            >
                                {loading ? "Signing in..." : "Sign in"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};
