# Reservations module (Role D): NGO board and reservations

Endpoints (all under `/api/v1`): `GET /geocode`, `GET /board`, `POST /listings/{id}/reserve`,
`POST /listings/{id}/cancel-reservation`, `POST /listings/{id}/complete`, `GET /ngo/reservations`,
`POST /listings/{id}/rate-provider`.

| File | Purpose |
|---|---|
| `router.py` | The endpoints above |
| `service.py` | Business rules 4-7 (atomic reserve, cancel, complete, rate, expiry) |
| `geo.py` | Haversine distance (km) |
| `geocode.py` | Nominatim proxy: User-Agent, 24h cache, 1 req/s throttle |
| `storage.py` | Proof file storage (single swap point for Role C's upload service) |
| `deps.py` | Auth seam and role / verification guards |
| `errors.py` | `{ "detail", "code" }` error shape |
| `expiry.py` | Background job that expires overdue `listed` listings |

## How atomic reservation works
`reserve_listing` issues one statement:
`UPDATE listings SET status='reserved', reserved_by_ngo_id=:ngo, reserved_at=now() WHERE id=:id AND status='listed' AND window_end > now()`.
PostgreSQL serialises concurrent updates on the row, so exactly one caller sees `rowcount == 1`; the rest get
`409 ALREADY_RESERVED` (or `409 LISTING_EXPIRED`). `complete` and `rate-provider` take a row lock (`SELECT ... FOR UPDATE`).
Cancel is also a single conditional UPDATE that picks `listed` or `expired` from `window_end`.

## Nominatim usage policy (https://operations.osmfoundation.org/policies/nominatim/)
Identifying `User-Agent` (**set `NOMINATIM_USER_AGENT` to include a real contact before the demo**), max 1 request/second
(process-wide lock), results cached for 24h, no autocomplete (the UI searches only when the button is pressed),
OSM attribution shown in the UI. Results are limited to India by default (`NOMINATIM_COUNTRY_CODES=in`, empty disables).

## Configuration
| Variable | Default | Meaning |
|---|---|---|
| `NOMINATIM_USER_AGENT` | placeholder | Must identify the app and a contact |
| `NOMINATIM_URL` | public Nominatim | Override to self-host |
| `NOMINATIM_COUNTRY_CODES` | `in` | Restrict geocoding |
| `PRIVATE_UPLOAD_DIR` | `/data/private` | Private Docker volume for proofs |
| `MAX_UPLOAD_BYTES` | 10 MB | Per-file cap |
| `TEST_DATABASE_URL` | local Postgres | Used by the tests only |

## Integration points (to wire at merge)
1. **Auth**: `deps.py` imports `get_current_user` from `app.auth.dependencies` (Role B). It must return an object with `.id` and `.role`. If the name differs, change that one import. Until it resolves, endpoints return `500 AUTH_NOT_WIRED`.
2. **App wiring** (main.py): `register_error_handlers(app)` then `app.include_router(router, prefix="/api/v1")`; optionally `FastAPI(lifespan=expiry_lifespan)` for the expiry job.
3. **Models/session**: uses `app.db.models` (`User, ProviderProfile, NgoProfile, Document, Listing, Proof, Rating`) and `app.db.session.get_db` exactly as in the contract's TABLES.
4. **Uploads**: `storage.save_proof_file` implements rule 8 itself (PDF/JPG/PNG by content, size cap, random names, private dir) until Role C's service is available; replace that function body to delegate to it.

## Tests and coverage
```
cd backend
TEST_DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/shareplate_test \
  pytest tests/reservations --cov=app.reservations --cov-report=term-missing
```
34 tests, **97 % coverage** of `app/reservations`. Requires PostgreSQL (the race test is meaningless on SQLite).
Covered: double-reservation race (10 concurrent NGOs, and 2 concurrent HTTP requests), unverified NGO blocked, expired listing
blocked, complete without proof rejected, duplicate rating rejected, distance ordering, plus cancel rules, file validation,
rating averages, general providers never rated, geocode caching/throttle/User-Agent, expiry job.

## CI (add to Role B's backend job)
```yaml
  backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_USER: postgres, POSTGRES_PASSWORD: postgres, POSTGRES_DB: shareplate_test }
        ports: ['5432:5432']
        options: >-
          --health-cmd "pg_isready -U postgres" --health-interval 5s --health-timeout 5s --health-retries 10
    env:
      TEST_DATABASE_URL: postgresql+psycopg://postgres:postgres@localhost:5432/shareplate_test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.12' }
      - run: pip install -r backend/requirements.txt pytest pytest-cov
      - run: pytest tests --cov=app.reservations --cov-report=term-missing --cov-report=xml
        working-directory: backend
```
Needs `httpx`, `python-multipart` and `psycopg[binary]` in `requirements.txt`.

## Deviations / interpretations to report to the frontend lead
1. **New error codes** (statuses follow the contract): `NOT_FOUND` 404, `FORBIDDEN` 403, `ALREADY_RESERVED` 409, `LISTING_EXPIRED` 409, `INVALID_STATE` 409, `ALREADY_RATED` 409, `PROOF_REQUIRED` 400, `INVALID_FILE`/`INVALID_FILE_TYPE`/`FILE_TOO_LARGE` 400, `NOT_RATEABLE` 400, `LOCATION_REQUIRED` 400, `GEOCODER_UNAVAILABLE` 502.
2. **Extra fields**: `/board` items add flat `org_name`, `rating_avg` (null for general providers), `rating_count`, `provider_category` (the contract says "provider org_name, rating_avg" without nesting, so flat was chosen). `/ngo/reservations` items add `org_name`, `provider_category`, `has_rated`. `rate-provider` returns `201 { listing_id, stars, comment, provider_rating_avg, provider_rating_count }`.
3. **`/board` lat/lng are optional**: if omitted the NGO's saved location is used (`400 LOCATION_REQUIRED` if none).
4. **Expiry job** expires only `listed` listings. A `reserved` listing past its window is left so the NGO can still upload proof; if they cancel it becomes `expired`.
5. **Proof kind** is inferred from content: images → `proof_photo`, PDF → `proof_letter`; one `proofs` row per uploaded file.
6. **Dependencies added**: backend `httpx`; frontend `leaflet`, `react-leaflet`.
