<?php

declare(strict_types=1);

namespace OMS\Orders\Services;

use OMS\Products\Models\Product;

class OrderPricingService
{
    /**
     * @param  array<int, array{product_id: int, quantity: int}>  $rawItems
     * @return array{
     *     subtotal: float,
     *     discount_type: ?string,
     *     discount_value: float,
     *     discount_amount: float,
     *     tax_rate: float,
     *     tax_amount: float,
     *     total: float,
     *     items: array<int, array{
     *         product_id: int,
     *         product_name: string,
     *         sku: string,
     *         quantity: int,
     *         unit_price: float,
     *         line_subtotal: float,
     *         discount_amount: float,
     *         tax_amount: float,
     *         line_total: float
     *     }>
     * }
     */
    public function calculate(
        array $rawItems,
        ?string $discountType = null,
        float $discountValue = 0.0,
        ?float $taxRate = null
    ): array {
        // Merge duplicate product_ids
        $merged = [];
        foreach ($rawItems as $item) {
            $pid = (int) $item['product_id'];
            $qty = (int) $item['quantity'];
            $merged[$pid] = ($merged[$pid] ?? 0) + $qty;
        }

        $products = Product::whereIn('id', array_keys($merged))->get()->keyBy('id');

        $lines = [];
        $subtotalCents = 0;

        foreach ($merged as $pid => $qty) {
            /** @var Product|null $product */
            $product = $products->get($pid);
            if (! $product) {
                continue;
            }

            $unitPriceCents = (int) round(((float) $product->price) * 100);
            $lineSubtotalCents = $qty * $unitPriceCents;
            $subtotalCents += $lineSubtotalCents;

            $lines[] = [
                'product' => $product,
                'quantity' => $qty,
                'unit_price_cents' => $unitPriceCents,
                'line_subtotal_cents' => $lineSubtotalCents,
            ];
        }

        $subtotal = round($subtotalCents / 100, 2);

        // Compute discount in cents
        $discountAmountCents = 0;
        if ($discountType === 'percent') {
            $discountAmountCents = (int) round($subtotalCents * ($discountValue / 100.0));
        } elseif ($discountType === 'fixed') {
            $discountAmountCents = (int) round($discountValue * 100);
        }
        $discountAmountCents = max(0, min($discountAmountCents, $subtotalCents));
        $discountAmount = round($discountAmountCents / 100, 2);

        // Tax rate and amount in cents
        $effectiveTaxRate = $taxRate !== null ? (float) $taxRate : (float) config('oms.tax_rate', 10.0);
        $taxableCents = $subtotalCents - $discountAmountCents;
        $taxAmountCents = (int) round($taxableCents * ($effectiveTaxRate / 100.0));
        $taxAmount = round($taxAmountCents / 100, 2);

        $totalCents = $taxableCents + $taxAmountCents;
        $total = round($totalCents / 100, 2);

        // Allocate discount and tax to lines
        $allocatedDiscountCents = 0;
        $allocatedTaxCents = 0;
        $count = count($lines);
        $calculatedItems = [];

        foreach ($lines as $idx => $line) {
            $isLast = ($idx === $count - 1);

            if ($isLast) {
                $lineDiscountCents = $discountAmountCents - $allocatedDiscountCents;
                $lineTaxCents = $taxAmountCents - $allocatedTaxCents;
            } else {
                $ratio = $subtotalCents > 0 ? ($line['line_subtotal_cents'] / $subtotalCents) : 0;
                $lineDiscountCents = (int) round($discountAmountCents * $ratio);
                $lineTaxCents = (int) round($taxAmountCents * $ratio);
                $allocatedDiscountCents += $lineDiscountCents;
                $allocatedTaxCents += $lineTaxCents;
            }

            $lineTotalCents = $line['line_subtotal_cents'] - $lineDiscountCents + $lineTaxCents;

            $calculatedItems[] = [
                'product_id' => $line['product']->id,
                'product_name' => $line['product']->name,
                'sku' => $line['product']->sku,
                'quantity' => $line['quantity'],
                'unit_price' => round($line['unit_price_cents'] / 100, 2),
                'line_subtotal' => round($line['line_subtotal_cents'] / 100, 2),
                'discount_amount' => round($lineDiscountCents / 100, 2),
                'tax_amount' => round($lineTaxCents / 100, 2),
                'line_total' => round($lineTotalCents / 100, 2),
            ];
        }

        return [
            'subtotal' => $subtotal,
            'discount_type' => $discountType,
            'discount_value' => $discountValue,
            'discount_amount' => $discountAmount,
            'tax_rate' => $effectiveTaxRate,
            'tax_amount' => $taxAmount,
            'total' => $total,
            'items' => $calculatedItems,
        ];
    }
}
