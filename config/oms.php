<?php

return [
    'tax_rate' => (float) env('OMS_TAX_RATE', 10),
    'login_throttle' => (int) env('OMS_LOGIN_THROTTLE', 5),
    'api_throttle' => (int) env('OMS_API_THROTTLE', 120),
    'max_per_page' => (int) env('OMS_MAX_PER_PAGE', 100),
];
