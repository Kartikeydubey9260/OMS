<?php

declare(strict_types=1);

namespace OMS\Users\Proxies;

use OMS\Core\Proxies\ModelProxy;
use OMS\Users\Models\User;

class UserProxy extends ModelProxy
{
    public static function modelClass(): string
    {
        return User::class;
    }
}
