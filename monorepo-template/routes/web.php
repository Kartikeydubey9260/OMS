<?php

use Illuminate\Support\Facades\Route;

// SPA fallback: every non-API, non-asset URL is handled by React Router on the client.
// API lives in routes/api.php under /api. Keep this as the LAST route.
Route::view('/{any?}', 'app')->where('any', '^(?!api(/|$)|build/|storage/|up$).*$');
