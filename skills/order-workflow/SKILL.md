---
name: order-workflow
description: Use when implementing order creation/update, pricing/totals, the status machine, status history, stock reservation, assignment, notes, activity feed or concurrency control in the OMS.
---

# Order workflow skill

Source of truth: `docs/05-business-rules.md`. This file gives code shapes.

## Enums

```php
enum OrderStatus: string {
    case Draft='draft'; case Pending='pending'; case Confirmed='confirmed';
    case Processing='processing'; case Ready='ready'; case Completed='completed'; case Cancelled='cancelled';

    /** @return list<self> */
    public function allowedNext(): array { return match($this) {
        self::Draft      => [self::Pending, self::Cancelled],
        self::Pending    => [self::Confirmed, self::Cancelled, self::Draft],
        self::Confirmed  => [self::Processing, self::Cancelled],
        self::Processing => [self::Ready, self::Cancelled],
        self::Ready      => [self::Completed, self::Cancelled],
        self::Completed, self::Cancelled => [],
    }; }
    public function canTransitionTo(self $to): bool { return in_array($to, $this->allowedNext(), true); }
    public function isTerminal(): bool { return $this->allowedNext() === []; }
    public function holdsStock(): bool { return in_array($this, [self::Confirmed,self::Processing,self::Ready,self::Completed], true); }
}
enum OrderPriority: string { case Low='low'; case Normal='normal'; case High='high'; case Urgent='urgent'; }
```

## OrderPricingService (pure, no DB writes)

```php
public function calculate(array $items, ?string $discountType, float $discountValue, ?float $taxRate = null): PricingResult
```

1. Fetch products `whereIn(id)` active; merge duplicate ids; throw validation error if any missing/inactive.
2. Work in **cents** (`(int) round($price*100)`). 3. Compute per `docs/05` §1 incl. proportional allocation with remainder to last line.
3. Return DTO: `lines[] (product, qty, unit_price, line_subtotal, discount, tax, line_total)`, `subtotal, discount_amount, tax_rate, tax_amount, total`.
   Unit tests: the 350/20/33/363 example, percent discount, discount > subtotal clamp, rounding remainder sums exactly, inactive product rejected.

## OrderService::create(CreateOrderData $d, User $actor)

```
DB::transaction:
  pricing = pricing->calculate(...)
  order  = Order::create([... status draft|pending, version 1, created_by])
  order->items()->createMany(lines)
  order->update(['order_number' => 'ORD-'.(10000 + $order->id)])   // or sequence table
  status history: null → status
  activity 'created'; audit order.created (new values)
  if assigned_to: activity+audit 'assigned'
  DB::afterCommit: event(OrderCreated), event(OrderAssigned) if assigned
```

Initial status other than draft/pending is rejected. Initial `notes` also stored as first `order_notes` row if provided.

## OrderService::update(Order $o, UpdateOrderData $d, User $actor)

- Reject if status not in draft/pending (`422`, "Only draft or pending orders can be edited").
- `Order::where('id',$o->id)->where('version',$d->version)->update([... 'version'=>DB::raw('version+1')])`; 0 rows → `StaleOrderException`.
- Re-price from scratch when items/discount change: delete+recreate items (or diff). Diff old vs new for audit (only changed keys; items summarised).
- Handle assignment change via the same path as `assign()` (separate audit action).

## OrderStatusService::transition(Order $o, OrderStatus $to, User $actor, ?string $remarks, ?int $version)

```
DB::transaction:
  $o = Order::lockForUpdate()->findOrFail($o->id)
  if version provided and mismatch → StaleOrderException
  if (!$o->status->canTransitionTo($to)) throw new InvalidStatusTransition($o->status,$to)
  Gate::forUser($actor)->authorize('changeStatus', [$o, $to])     // staff allowed-status rule lives in policy via config
  rules: cancel from confirmed+ requires remarks; leaving draft requires >=1 item
  stock: to==Confirmed → stock->reserve($o); to==Cancelled && $o->stock_reserved → stock->release($o)
  update status + timestamps + version++
  insert order_status_histories, order_activities, audit order.status_changed {status: from→to}
  DB::afterCommit: event(new OrderStatusChanged($o,$from,$to,$actor))
```

## StockService

```php
public function reserve(Order $o): void {
    $items = $o->items()->orderBy('product_id')->get();
    $products = Product::whereIn('id',$items->pluck('product_id'))->orderBy('id')->lockForUpdate()->get()->keyBy('id');
    $short = []; foreach ($items as $i) if ($products[$i->product_id]->stock_quantity < $i->quantity) $short[] = ...;
    if ($short) throw new InsufficientStock($short);
    foreach ($items as $i) $products[$i->product_id]->decrement('stock_quantity',$i->quantity);
    $o->forceFill(['stock_reserved'=>true])->save();
    // dispatch LowStockDetected after commit when <= threshold
}
public function release(Order $o): void { /* increment back in id order, stock_reserved=false, activity */ }
```

## Assignment

`assign(Order,$userId,$actor)`: assignee must be active & role in (admin, manager, staff); no-op if same; audit `order.assigned` with names old→new; activity; event `OrderAssigned`.

## Notes

`addNote(Order,$body,$actor)`: allowed on any status (incl. terminal); Staff only on assigned; strip nothing (store raw, escape on render); activity `note_added`; event `NoteAdded` (optional notify assignee).

## allowed_transitions in resource

Return only transitions the **current user** may perform: `$o->status->allowedNext()` filtered by `Gate::allows('changeStatus',[$o,$next])`. Frontend renders buttons from this list.

## Required tests (Feature, Pest/PHPUnit)

create ok (totals 363) · create validation (no items, qty 0, missing/inactive product, nonexistent customer) · client-sent totals ignored · update only draft/pending · stale version 409 · each valid transition · invalid transitions (completed→draft, cancelled→processing, draft→ready) 422 · staff cannot cancel/confirm · confirm reserves stock · insufficient stock 422 and no partial change · cancel after confirm restores stock · status history rows written · audit rows written · staff only sees assigned orders · delete only admin and only draft/cancelled.
