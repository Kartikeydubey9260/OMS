<?php

declare(strict_types=1);

namespace OMS\Orders\Enums;

enum OrderPriority: string
{
    case LOW = 'low';
    case NORMAL = 'normal';
    case HIGH = 'high';
    case URGENT = 'urgent';
}
