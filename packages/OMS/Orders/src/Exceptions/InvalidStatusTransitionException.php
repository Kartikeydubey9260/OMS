<?php

declare(strict_types=1);

namespace OMS\Orders\Exceptions;

use Exception;

class InvalidStatusTransitionException extends Exception
{
    public function __construct(string $message = 'Invalid status transition.')
    {
        parent::__construct($message);
    }
}
