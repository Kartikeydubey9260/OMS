<?php

use App\Providers\AppServiceProvider;
use OMS\Admin\Providers\AdminServiceProvider;
use OMS\API\Providers\APIServiceProvider;
use OMS\Core\Providers\CoreServiceProvider;
use OMS\Customers\Providers\CustomersServiceProvider;
use OMS\Inventory\Providers\InventoryServiceProvider;
use OMS\Orders\Providers\OrdersServiceProvider;
use OMS\Products\Providers\ProductsServiceProvider;
use OMS\Users\Providers\UsersServiceProvider;

return [
    AppServiceProvider::class,
    CoreServiceProvider::class,
    UsersServiceProvider::class,
    CustomersServiceProvider::class,
    ProductsServiceProvider::class,
    InventoryServiceProvider::class,
    OrdersServiceProvider::class,
    AdminServiceProvider::class,
    APIServiceProvider::class,
];
