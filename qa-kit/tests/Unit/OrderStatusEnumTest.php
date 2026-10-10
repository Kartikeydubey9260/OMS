<?php

declare(strict_types=1);

use OMS\Orders\Enums\OrderPriority;
use OMS\Orders\Enums\OrderStatus;

// Pure unit tests: no database. transitionMap() / ALL_STATUSES live in tests/Pest.php (docs/05 §2).

it('defines exactly the seven documented statuses', function () {
    expect(array_map(fn (OrderStatus $s) => $s->value, OrderStatus::cases()))->toEqualCanonicalizing(ALL_STATUSES);
});

it('defines exactly the four priorities', function () {
    expect(array_map(fn (OrderPriority $p) => $p->value, OrderPriority::cases()))
        ->toEqualCanonicalizing(['low', 'normal', 'high', 'urgent']);
});

it('lists exactly the documented next statuses', function (string $from) {
    $next = array_map(fn (OrderStatus $s) => $s->value, OrderStatus::from($from)->allowedNext());

    expect($next)->toEqualCanonicalizing(transitionMap()[$from]);
})->with(ALL_STATUSES);

it('answers canTransitionTo consistently with the map for all 49 pairs', function (string $from, string $to) {
    $expected = in_array($to, transitionMap()[$from], true);

    expect(OrderStatus::from($from)->canTransitionTo(OrderStatus::from($to)))->toBe($expected);
})->with(function () {
    foreach (ALL_STATUSES as $from) {
        foreach (ALL_STATUSES as $to) {
            yield "{$from} → {$to}" => [$from, $to];
        }
    }
});

it('never allows a status to transition to itself', function (string $status) {
    expect(OrderStatus::from($status)->canTransitionTo(OrderStatus::from($status)))->toBeFalse();
})->with(ALL_STATUSES);

it('treats only completed and cancelled as terminal', function (string $status, bool $terminal) {
    expect(OrderStatus::from($status)->isTerminal())->toBe($terminal);
})->with([
    ['draft', false], ['pending', false], ['confirmed', false], ['processing', false], ['ready', false],
    ['completed', true], ['cancelled', true],
]);

it('knows which statuses hold reserved or deducted stock', function (string $status, bool $holds) {
    expect(OrderStatus::from($status)->holdsStock())->toBe($holds);
})->with([
    ['draft', false], ['pending', false], ['cancelled', false],
    ['confirmed', true], ['processing', true], ['ready', true], ['completed', true],
]);

it('rejects unknown status values', function () {
    expect(fn () => OrderStatus::from('teleported'))->toThrow(ValueError::class)
        ->and(OrderStatus::tryFrom('teleported'))->toBeNull();
});
