<?php

declare(strict_types=1);

namespace OMS\Inventory\Exceptions;

use Exception;

class InsufficientStockException extends Exception
{
    /**
     * @var array<string, mixed>
     */
    protected array $errors = [];

    /**
     * @param  array<string, mixed>  $errors
     */
    public function __construct(string $message = 'Insufficient stock for one or more items.', array $errors = [])
    {
        parent::__construct($message);
        $this->errors = $errors;
    }

    /**
     * @return array<string, mixed>
     */
    public function getErrors(): array
    {
        return $this->errors;
    }
}
