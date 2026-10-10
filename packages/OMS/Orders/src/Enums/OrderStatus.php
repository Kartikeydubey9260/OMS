<?php

declare(strict_types=1);

namespace OMS\Orders\Enums;

enum OrderStatus: string
{
    case DRAFT = 'draft';
    case PENDING = 'pending';
    case CONFIRMED = 'confirmed';
    case PROCESSING = 'processing';
    case READY = 'ready';
    case COMPLETED = 'completed';
    case CANCELLED = 'cancelled';

    /**
     * @return array<OrderStatus>
     */
    public function allowedNext(): array
    {
        return match ($this) {
            self::DRAFT => [self::PENDING, self::CANCELLED],
            self::PENDING => [self::CONFIRMED, self::CANCELLED, self::DRAFT],
            self::CONFIRMED => [self::PROCESSING, self::CANCELLED],
            self::PROCESSING => [self::READY, self::CANCELLED],
            self::READY => [self::COMPLETED, self::CANCELLED],
            self::COMPLETED => [],
            self::CANCELLED => [],
        };
    }

    public function canTransitionTo(self $target): bool
    {
        if ($this === $target) {
            return false;
        }

        return in_array($target, $this->allowedNext(), true);
    }

    public function isTerminal(): bool
    {
        return match ($this) {
            self::COMPLETED, self::CANCELLED => true,
            default => false,
        };
    }

    public function holdsStock(): bool
    {
        return match ($this) {
            self::CONFIRMED, self::PROCESSING, self::READY, self::COMPLETED => true,
            default => false,
        };
    }
}
