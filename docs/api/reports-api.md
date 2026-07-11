# Reports API

## POST /api/reports

Generate (or serve cached) an advisory report.

### Request

```json
{
  "subject": "coastal site conditions",
  "region": "central gulf coast",
  "period": "october",
  "targetDate": "2026-10-15",
  "parameters": { "lat": "29.3", "lng": "-94.8", "timezone": "America/Chicago" }
}
```

`subject`, `region`, `period`, and `targetDate` (YYYY-MM-DD) are required and
validated with Zod at the boundary. `parameters` is optional; `lat`/`lng` enable
the weather signal, and are absent-safe.

### Response `200`

```json
{
  "key": "coastal-site-conditions::central-gulf-coast::october",
  "advisory": { "summary": "...", "outlook": "...", "key_factors": [], "recommendations": [] },
  "overlay": { "today_outlook": "...", "highlights": [], "adjustments": [] },
  "signals": { "results": { "temporal": {} }, "missing": [] },
  "provenance": {
    "cacheHit": false,
    "overlayCacheHit": false,
    "model": "example/model-name",
    "missingSignals": [],
    "generatedAt": "2026-10-15T12:00:00.000Z"
  }
}
```

`overlay` is `null` when the target date is outside the live window.

### Errors

| Status | Meaning |
|---|---|
| `400` | Body is not valid JSON, or fails schema validation (issues included) |
| `503` | AI provider is not configured on this deployment (a `ConfigError`) |
| `500` | Report generation failed (honest error message) |

The `503` is deliberate: an unconfigured provider is an operational state, not a
bug, and is reported as such rather than as a crash.
