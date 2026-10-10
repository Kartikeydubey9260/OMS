import React from "react";
import { createRoot } from "react-dom/client";

function App() {
    return (
        <div id="oms-app">
            OMS frontend mount point — implement features only when authorized.
        </div>
    );
}

const element = document.getElementById("app");
if (element)
    createRoot(element).render(
        <React.StrictMode>
            <App />
        </React.StrictMode>,
    );
