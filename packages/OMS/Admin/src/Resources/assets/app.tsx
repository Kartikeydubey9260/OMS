import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./state/auth";
import { Navbar } from "./components/Navbar";
import { ToastContainer } from "./components/ToastContainer";

import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { OrdersListPage } from "./pages/OrdersListPage";
import { OrderWizardPage } from "./pages/OrderWizardPage";
import { OrderDetailPage } from "./pages/OrderDetailPage";
import { OrderEditPage } from "./pages/OrderEditPage";
import { CustomersListPage } from "./pages/CustomersListPage";
import { CustomerCreatePage } from "./pages/CustomerCreatePage";
import { CustomerDetailPage } from "./pages/CustomerDetailPage";
import { CustomerEditPage } from "./pages/CustomerEditPage";
import { ProductsListPage } from "./pages/ProductsListPage";
import { ProductCreatePage } from "./pages/ProductCreatePage";
import { ProductEditPage } from "./pages/ProductEditPage";
import { UsersPage } from "./pages/UsersPage";
import { AuditLogsPage } from "./pages/AuditLogsPage";
import { ForbiddenPage } from "./pages/ForbiddenPage";
import { NotFoundPage } from "./pages/NotFoundPage";

interface ProtectedRouteProps {
    children: React.ReactNode;
    roles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, roles }) => {
    const { isAuthenticated, user } = useAuth();
    const location = useLocation();

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (roles && user) {
        const hasAccess =
            user.role === "admin" ||
            user.role === "super-admin" ||
            roles.includes(user.role);
        if (!hasAccess) {
            return <ForbiddenPage />;
        }
    }

    return <>{children}</>;
};

const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isAuthenticated } = useAuth();
    const location = useLocation();
    const isLogin = location.pathname === "/login";

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-gray-900 overflow-x-hidden">
            {isAuthenticated && !isLogin && <Navbar />}
            <main className="flex-1 w-full overflow-x-hidden">
                {children}
            </main>
            <ToastContainer />
        </div>
    );
};

export const App: React.FC = () => {
    const { isAuthenticated, user } = useAuth();

    return (
        <BrowserRouter>
            <AppShell>
                <Routes>
                    {/* Public Login Route */}
                    <Route
                        path="/login"
                        element={
                            isAuthenticated ? (
                                <Navigate
                                    to={user?.role === "staff" ? "/orders" : "/dashboard"}
                                    replace
                                />
                            ) : (
                                <LoginPage />
                            )
                        }
                    />

                    {/* Root Landing Route */}
                    <Route
                        path="/"
                        element={
                            isAuthenticated ? (
                                <Navigate
                                    to={user?.role === "staff" ? "/orders" : "/dashboard"}
                                    replace
                                />
                            ) : (
                                <Navigate to="/login" replace />
                            )
                        }
                    />

                    {/* Dashboard: Admin & Manager Only */}
                    <Route
                        path="/dashboard"
                        element={
                            <ProtectedRoute roles={["admin", "manager"]}>
                                <DashboardPage />
                            </ProtectedRoute>
                        }
                    />

                    {/* Orders List: All Authenticated Roles */}
                    <Route
                        path="/orders"
                        element={
                            <ProtectedRoute>
                                <OrdersListPage />
                            </ProtectedRoute>
                        }
                    />

                    {/* Create Order: Admin & Manager Only */}
                    <Route
                        path="/orders/new"
                        element={
                            <ProtectedRoute roles={["admin", "manager"]}>
                                <OrderWizardPage />
                            </ProtectedRoute>
                        }
                    />

                    {/* Order Detail: All Authenticated Roles */}
                    <Route
                        path="/orders/:id"
                        element={
                            <ProtectedRoute>
                                <OrderDetailPage />
                            </ProtectedRoute>
                        }
                    />

                    {/* Order Edit: Admin & Manager Only */}
                    <Route
                        path="/orders/:id/edit"
                        element={
                            <ProtectedRoute roles={["admin", "manager"]}>
                                <OrderEditPage />
                            </ProtectedRoute>
                        }
                    />

                    {/* Customers List: All Authenticated Roles */}
                    <Route
                        path="/customers"
                        element={
                            <ProtectedRoute>
                                <CustomersListPage />
                            </ProtectedRoute>
                        }
                    />

                    {/* Create Customer: Admin & Manager Only */}
                    <Route
                        path="/customers/new"
                        element={
                            <ProtectedRoute roles={["admin", "manager"]}>
                                <CustomerCreatePage />
                            </ProtectedRoute>
                        }
                    />

                    {/* Customer Detail: All Authenticated Roles */}
                    <Route
                        path="/customers/:id"
                        element={
                            <ProtectedRoute>
                                <CustomerDetailPage />
                            </ProtectedRoute>
                        }
                    />

                    {/* Edit Customer: Admin & Manager Only */}
                    <Route
                        path="/customers/:id/edit"
                        element={
                            <ProtectedRoute roles={["admin", "manager"]}>
                                <CustomerEditPage />
                            </ProtectedRoute>
                        }
                    />

                    {/* Products List: All Authenticated Roles */}
                    <Route
                        path="/products"
                        element={
                            <ProtectedRoute>
                                <ProductsListPage />
                            </ProtectedRoute>
                        }
                    />

                    {/* Create Product: Admin Only */}
                    <Route
                        path="/products/new"
                        element={
                            <ProtectedRoute roles={["admin"]}>
                                <ProductCreatePage />
                            </ProtectedRoute>
                        }
                    />

                    {/* Edit Product: Admin Only */}
                    <Route
                        path="/products/:id/edit"
                        element={
                            <ProtectedRoute roles={["admin"]}>
                                <ProductEditPage />
                            </ProtectedRoute>
                        }
                    />

                    {/* Users Management: Admin Only */}
                    <Route
                        path="/users"
                        element={
                            <ProtectedRoute roles={["admin"]}>
                                <UsersPage />
                            </ProtectedRoute>
                        }
                    />

                    {/* Audit Logs: Admin Only */}
                    <Route
                        path="/audit-logs"
                        element={
                            <ProtectedRoute roles={["admin"]}>
                                <AuditLogsPage />
                            </ProtectedRoute>
                        }
                    />

                    {/* Explicit 403 route */}
                    <Route path="/403" element={<ForbiddenPage />} />

                    {/* Fallback 404 Route */}
                    <Route path="*" element={<NotFoundPage />} />
                </Routes>
            </AppShell>
        </BrowserRouter>
    );
};

const element = document.getElementById("app");
if (element) {
    createRoot(element).render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );
}

export default App;
