<?php

declare(strict_types=1);

namespace OMS\Products\Models;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;
use OMS\Orders\Models\OrderItem;
use OMS\Products\Contracts\Product as ProductContract;
use OMS\Products\Database\Factories\ProductFactory;

/**
 * @property int $id
 * @property string $sku
 * @property string $name
 * @property string|null $description
 * @property string|float $price
 * @property string|float|null $tax_rate
 * @property int $stock_quantity
 * @property int $low_stock_threshold
 * @property string $status
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Carbon|null $deleted_at
 * @property-read Collection<int, OrderItem> $orderItems
 */
class Product extends Model implements ProductContract
{
    use HasFactory, SoftDeletes;

    protected $table = 'products';

    protected $fillable = [
        'sku',
        'name',
        'description',
        'price',
        'tax_rate',
        'stock_quantity',
        'low_stock_threshold',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'tax_rate' => 'decimal:2',
            'stock_quantity' => 'integer',
            'low_stock_threshold' => 'integer',
        ];
    }

    public function orderItems(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    protected static function newFactory(): ProductFactory
    {
        return ProductFactory::new();
    }
}
