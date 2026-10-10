export const formatMoney = (amount: number | string | null | undefined): string => {
    const val = typeof amount === "string" ? parseFloat(amount) : (amount ?? 0);
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
    }).format(isNaN(val) ? 0 : val);
};

export const formatCount = (count: number | string | null | undefined): string => {
    const val = typeof count === "string" ? parseInt(count, 10) : (count ?? 0);
    return (isNaN(val) ? 0 : val).toLocaleString("en-US");
};

export const capitalize = (str: string | null | undefined): string => {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};
