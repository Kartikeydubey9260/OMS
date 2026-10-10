<?php

declare(strict_types=1);

namespace OMS\Orders\Proxies;

use OMS\Core\Proxies\ModelProxy;
use OMS\Orders\Models\Order;

class OrderProxy extends ModelProxy
{
    public static function modelClass(): string
    {
        return Order::class;
    }
}
