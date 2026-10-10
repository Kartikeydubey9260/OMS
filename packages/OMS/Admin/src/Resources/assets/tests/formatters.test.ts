import { describe, it, expect } from "vitest";
import { formatMoney, formatCount, capitalize } from "../utils/formatters";

describe("formatters", () => {
    it("formats currency in USD with decimals", () => {
        expect(formatMoney(363)).toBe("$363.00");
        expect(formatMoney("123.45")).toBe("$123.45");
        expect(formatMoney(0)).toBe("$0.00");
    });

    it("formats counts with US locale grouping", () => {
        expect(formatCount(12345)).toBe("12,345");
        expect(formatCount("1000000")).toBe("1,000,000");
        expect(formatCount(0)).toBe("0");
    });

    it("capitalizes words cleanly", () => {
        expect(capitalize("pending")).toBe("Pending");
        expect(capitalize("CONFIRMED")).toBe("Confirmed");
        expect(capitalize("")).toBe("");
    });
});
