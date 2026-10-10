<?php

declare(strict_types=1);

it('returns healthy status on /api/health', function () {
    $this->getJson('/api/health')
        ->assertOk()
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.status', 'ok');
});

it('returns json 404 for unknown api routes', function () {
    $this->getJson('/api/non-existent-route')
        ->assertNotFound()
        ->assertJsonPath('success', false)
        ->assertJsonPath('code', 'NOT_FOUND');
});
