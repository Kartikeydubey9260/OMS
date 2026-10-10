<?php

declare(strict_types=1);

namespace OMS\Core\Proxies;

abstract class ModelProxy
{
    /**
     * @return class-string
     */
    abstract public static function modelClass(): string;
}
