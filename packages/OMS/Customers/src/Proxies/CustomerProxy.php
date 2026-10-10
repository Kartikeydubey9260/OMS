<?php

declare(strict_types=1);

namespace OMS\Customers\Proxies;

use OMS\Core\Proxies\ModelProxy;
use OMS\Customers\Models\Customer;

class CustomerProxy extends ModelProxy
{
    public static function modelClass(): string
    {
        return Customer::class;
    }
}
