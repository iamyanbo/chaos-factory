# Blade Brawl performance

Baseline was recorded before gameplay or renderer fixes. All runs use the real Chrome1920x1080 /play page,32FFA fighters,seed42,20seconds at normal speed,without a video encoder.

## Result

**Controlled normal run: PASS for the requested20ms budget.** Longest rAF interval16.90ms; longest game animation callback10.762ms; zero intervals above20ms. A concurrent Vitest run produced larger scheduling stalls, so the final controlled trace was taken after all simulations/tests had finished.

Changes: removed per-hit freezes; pooled trail discs and sparks; cached HP glyph atlases; avoided redundant text texture and static-wall rebuilds. Blade contacts were already analytic. Sampled CPU data identified circle tessellation, text uploads and cold WASM execution. Cold contact/CCD/event paths now warm up in a disposable Rapier world during loading; that world consumes no game RNG and never advances the played round.

## Baseline before fixes

Recorded2026-10-26T03:51:52.666Z; Chrome156.0.8078.47; AMD Ryzen 5 5600X 6-Core Processor             .
Wall20.001s; game8.733s. Blade/ball-renderer source hash: f2123aa488f71610142e3219b6d5f9c358cd4e00b7fb8f3ed7a4f47f0b712167.
Raw Chrome Performance trace: baseline-performance.trace.json. CPU sampling enabled.
rAF intervals: median16.70ms; p9932.50ms; max183.30ms; over20ms:12.

| Longest animation callback (ms) | Relative time (s) |
| ---: | ---: |
|62.760|0.000|
|40.904|6.626|
|33.864|3.090|
|25.546|5.804|
|25.366|2.471|
|23.994|5.152|
|23.513|2.616|
|23.269|2.537|
|22.527|6.139|
|22.379|5.177|

| Longest main-thread task (ms) | Relative time (s) |
| ---: | ---: |
|138.303|-0.138|
|63.737|-0.000|
|41.758|6.626|
|34.616|3.090|
|29.047|12.821|
|26.511|5.803|
|26.297|2.471|
|25.567|0.520|
|25.084|2.537|
|25.060|2.616|

## After renderer/combat fixes, before physics warmup

Recorded2026-10-26T04:08:22.225Z; Chrome156.0.8078.47; AMD Ryzen 5 5600X 6-Core Processor             .
Wall20.001s; game19.133s. Blade/ball-renderer source hash: abd462f6b82745cdc20b0927dde1fd48eab6740acef85bd2a37eb281f2021d28.
Raw Chrome Performance trace: after-performance.trace.json. CPU sampling enabled.
rAF intervals: median16.70ms; p9916.80ms; max150.00ms; over20ms:1.

| Longest animation callback (ms) | Relative time (s) |
| ---: | ---: |
|53.253|0.000|
|12.310|3.474|
|9.610|0.054|
|9.403|0.475|
|8.912|0.074|
|7.113|0.891|
|6.527|0.092|
|6.269|0.291|
|6.206|0.858|
|5.980|0.191|

| Longest main-thread task (ms) | Relative time (s) |
| ---: | ---: |
|110.848|-0.111|
|54.116|-0.000|
|13.245|3.474|
|12.092|0.074|
|10.227|0.054|
|10.002|0.475|
|8.276|0.091|
|8.093|0.158|
|8.006|0.891|
|7.283|0.341|

## Final normal run after loading warmup, timeline only

Recorded2026-10-26T04:30:55.549Z; Chrome156.0.8078.47; AMD Ryzen 5 5600X 6-Core Processor             .
Wall20.008s; game19.100s. Blade/ball-renderer source hash: e9c4991f8a611e50db6c36e78b857fcde2c4cb07b23b800ba7c7251cd6a9a31e.
Raw Chrome Performance trace: normal-run-performance.trace.json. Timeline-only timing verification; no CPU sampler.
rAF intervals: median16.70ms; p9916.80ms; max16.90ms; over20ms:0.

| Longest animation callback (ms) | Relative time (s) |
| ---: | ---: |
|10.762|0.000|
|8.834|3.517|
|6.611|0.750|
|6.161|0.650|
|5.718|6.000|
|5.519|0.984|
|5.375|5.417|
|5.294|0.217|
|5.267|0.117|
|5.198|3.817|

| Longest main-thread task (ms) | Relative time (s) |
| ---: | ---: |
|11.442|-0.000|
|9.466|3.517|
|7.597|0.750|
|7.080|0.650|
|6.848|0.983|
|6.444|6.000|
|6.288|5.434|
|6.103|5.417|
|5.955|0.117|
|5.933|0.833|

Negative task times include Chrome starting its profiler; these outliers remain in the tables. Callback CPU duration and real rAF scheduling intervals are reported separately. The sampled post-fix cold53ms callback remains above20ms; the final loading-warmup run has no over-budget frame. Simulation time trails wall time slightly because the explicitly requested kill-only80ms freezes remain.
