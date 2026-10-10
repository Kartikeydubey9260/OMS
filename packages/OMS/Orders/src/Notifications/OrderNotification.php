<?php

declare(strict_types=1);

namespace OMS\Orders\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class OrderNotification extends Notification
{
    use Queueable;

    public function __construct(
        protected string $type,
        protected string $message,
        protected int $orderId,
        protected string $orderNumber,
    ) {}

    /**
     * @return array<int, string>
     */
    public function via(mixed $notifiable): array
    {
        return ['database'];
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(mixed $notifiable): array
    {
        return [
            'type' => $this->type,
            'message' => $this->message,
            'order_id' => $this->orderId,
            'order_number' => $this->orderNumber,
        ];
    }
}
