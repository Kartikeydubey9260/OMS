<?php

declare(strict_types=1);

namespace OMS\Inventory\Contracts;

use OMS\Orders\Models\Order;
use OMS\Products\Models\Product;

interface InventoryService
{
    public function reserveStock(Order $order): void;

    public function restoreStock(Order $order): void;

    public function adjustStock(Product $product, int $quantity, string $reason): Product;
}
