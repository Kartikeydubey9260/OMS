import { describe, it, expect, beforeEach } from "vitest";
import { getStoredAuth, setStoredAuth, clearStoredAuth } from "../state/auth";

describe("auth state manager", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("reads empty auth initially", () => {
        expect(getStoredAuth()).toEqual({ token: null, user: null });
    });

    it("sets and retrieves auth in the oms-auth contract format", () => {
        const dummyUser = {
            id: 1,
            name: "Admin User",
            email: "admin@oms.test",
            role: "admin",
            permissions: ["*"],
        };

        setStoredAuth("dummy-token-xyz", dummyUser);

        const raw = localStorage.getItem("oms-auth");
        expect(raw).not.toBeNull();
        const parsed = JSON.parse(raw!);
        expect(parsed.version).toBe(0);
        expect(parsed.state.token).toBe("dummy-token-xyz");
        expect(parsed.state.user.email).toBe("admin@oms.test");

        const auth = getStoredAuth();
        expect(auth.token).toBe("dummy-token-xyz");
        expect(auth.user?.name).toBe("Admin User");
    });

    it("clears auth removing oms-auth key", () => {
        setStoredAuth("tok", { id: 2, name: "Staff", email: "s@oms.test", role: "staff", permissions: [] });
        clearStoredAuth();
        expect(localStorage.getItem("oms-auth")).toBeNull();
        expect(getStoredAuth()).toEqual({ token: null, user: null });
    });
});
