<?php

declare(strict_types=1);

namespace OMS\Customers\Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use OMS\Customers\Models\Customer;

/**
 * @extends Factory<Customer>
 */
class CustomerFactory extends Factory
{
    protected $model = Customer::class;

    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'phone' => fake()->phoneNumber(),
            'company' => fake()->company(),
            'address_line1' => fake()->streetAddress(),
            'address_line2' => 'Apt '.fake()->buildingNumber(),
            'city' => fake()->city(),
            'state' => fake()->city(),
            'postal_code' => fake()->postcode(),
            'country' => fake()->country(),
            'is_active' => true,
        ];
    }

    public function inactive(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_active' => false,
        ]);
    }
}
