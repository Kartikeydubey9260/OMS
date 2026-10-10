import React from "react";
import { Link } from "react-router-dom";

export const NotFoundPage: React.FC = () => {
    return (
        <div data-testid="not-found-page" className="min-h-[80vh] flex flex-col items-center justify-center p-4">
            <h1 data-testid="page-title" className="text-3xl font-extrabold text-gray-900 mb-2">
                404 — Page Not Found
            </h1>
            <p className="text-gray-600 mb-6 text-center max-w-md">
                The requested resource could not be found.
            </p>
            <Link
                to="/orders"
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 min-h-[38px]"
            >
                Return to Orders
            </Link>
        </div>
    );
};
