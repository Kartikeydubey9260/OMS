<?php

declare(strict_types=1);

namespace OMS\Products\Proxies;

use OMS\Core\Proxies\ModelProxy;
use OMS\Products\Models\Product;

class ProductProxy extends ModelProxy
{
    public static function modelClass(): string
    {
        return Product::class;
    }
}
