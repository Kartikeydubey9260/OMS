---
name: audit-logging
description: Use when adding audit logs, order activity feed, status history, or notifications to any OMS mutation.
---

# Audit, history, activity, notifications skill

Four different records — do not conflate:

| Record | Table | Audience | Purpose |
|---|---|---|---|
| Audit log | `audit_logs` | Admin | Who changed what, old→new, system-wide |
| Status history | `order_status_histories` | Everyone on the order | Timeline of status changes with remarks |
| Activity | `order_activities` | Everyone on the order | Human feed: status, notes, assignment, system |
| Notification | `notifications` | Individual users | Inbox alerts |

## AuditLogger service
```php
final class AuditLogger {
    private const HIDDEN = ['password','remember_token','token'];
    public function log(string $action, Model $subject, array $old, array $new, ?string $label = null): AuditLog {
        [$old,$new] = $this->diff($old,$new);               // keep only changed keys, strip HIDDEN
        return AuditLog::create([
            'user_id'=>auth()->id(), 'action'=>$action,
            'auditable_type'=>class_basename($subject)→snake, 'auditable_id'=>$subject->getKey(),
            'label'=>$label ?? $this->defaultLabel($action,$subject),
            'old_values'=>$old ?: null, 'new_values'=>$new ?: null,
            'ip_address'=>request()?->ip(),
        ]);
    }
}
```
Usage for model updates:
```php
$before = $customer->only(['name','email','phone','is_active']);
$customer->update($data);
$audit->log('customer.updated', $customer, $before, $customer->only(array_keys($before)));
```
Skip logging when the diff is empty.

## Rules
- Call inside the same `DB::transaction` as the change.
- Order label: `Updated Order #ORD-10234`; created/deleted similarly.
- Assignment: separate action `order.assigned` with `{assigned_to: oldId}`→`{assigned_to: newId}`; the API resource resolves ids → names for display ("John → David").
- Audit tables are append-only: no update/delete routes, no `SoftDeletes`, `UPDATED_AT = null` on the model.
- Required actions: order created/updated/deleted, status changed, assignment changed, customer updated, product updated (plus stock adjusted, user and role changes).
- Audit viewer: `GET /audit-logs` with filters, newest first, paginated, `select` only needed columns, index-backed (`created_at`, `(auditable_type, auditable_id)`).

## Activity + history helpers
```php
$order->activities()->create(['user_id'=>$actor->id,'type'=>'status_changed','description'=>"{$actor->name} changed status {$from->label()} → {$to->label()}",'meta'=>['from'=>..,'to'=>..,'remarks'=>..]]);
```
Detail resource merges `status_history`, `notes`, `activities` and the frontend renders a vertical timeline sorted by `created_at` desc/asc.

## Notifications
- Events: `OrderAssigned`, `OrderStatusChanged`, `NoteAdded` (optional), `LowStockDetected`.
- Listeners `implements ShouldQueue`, use `afterCommit = true`; send `OrderNotification` (`via: ['database']`) with `toArray(): {type, order_id, order_number, message}`.
- Never notify the actor. De-duplicate recipients (creator, assignee, managers).
- API: list (`unread` filter), `unread-count`, `read`, `read-all` operate only on `auth()->user()->notifications()`.
- Local dev: `php artisan queue:work` (or `QUEUE_CONNECTION=sync` for tests).
- Frontend: bell with unread badge, poll `unread-count` every 30–60s via TanStack Query `refetchInterval`; clicking marks read and navigates to the order.

## Tests
audit row created with correct old/new for priority change · none for no-op update · password never in audit · assignment audit · notification created for new assignee only · mark read / mark all read scoped to the user · audit endpoint 403 for non-admin.
