<?php

declare(strict_types=1);

namespace OMS\Inventory\Services;

use Illuminate\Support\Facades\DB;
use OMS\Core\Services\AuditLogger;
use OMS\Inventory\Contracts\InventoryService as InventoryServiceContract;
use OMS\Inventory\Exceptions\InsufficientStockException;
use OMS\Orders\Models\Order;
use OMS\Orders\Models\OrderItem;
use OMS\Products\Models\Product;

class InventoryService implements InventoryServiceContract
{
    public function reserveStock(Order $order): void
    {
        DB::transaction(function () use ($order) {
            $order->loadMissing('items');

            /** @var OrderItem $item */
            foreach ($order->items as $item) {
                /** @var Product $product */
                $product = Product::where('id', $item->product_id)->lockForUpdate()->firstOrFail();

                if ($product->stock_quantity < $item->quantity) {
                    throw new InsufficientStockException(
                        "Insufficient stock for product '{$product->name}' (SKU: {$product->sku}). Required: {$item->quantity}, Available: {$product->stock_quantity}.",
                        ['items' => ["Insufficient stock for product '{$product->name}'."]]
                    );
                }

                $product->decrement('stock_quantity', $item->quantity);
            }

            $order->update(['stock_reserved' => true]);
        });
    }

    public function restoreStock(Order $order): void
    {
        DB::transaction(function () use ($order) {
            if (! $order->stock_reserved) {
                return;
            }

            $order->loadMissing('items');

            /** @var OrderItem $item */
            foreach ($order->items as $item) {
                /** @var Product|null $product */
                $product = Product::where('id', $item->product_id)->lockForUpdate()->first();
                if ($product) {
                    $product->increment('stock_quantity', $item->quantity);
                }
            }

            $order->update(['stock_reserved' => false]);
        });
    }

    public function adjustStock(Product $product, int $quantity, string $reason): Product
    {
        return DB::transaction(function () use ($product, $quantity, $reason) {
            $lockedProduct = Product::where('id', $product->id)->lockForUpdate()->firstOrFail();
            $oldStock = $lockedProduct->stock_quantity;
            $newStock = $oldStock + $quantity;

            if ($newStock < 0) {
                throw new InsufficientStockException('Stock cannot be negative.');
            }

            $lockedProduct->stock_quantity = $newStock;
            $lockedProduct->save();

            AuditLogger::log(
                action: 'product.stock_adjusted',
                auditableType: 'product',
                auditableId: $lockedProduct->id,
                label: "Stock adjusted by {$quantity} for {$lockedProduct->name}: {$reason}",
                oldValues: ['stock_quantity' => $oldStock],
                newValues: ['stock_quantity' => $newStock]
            );

            return $lockedProduct;
        });
    }
}
