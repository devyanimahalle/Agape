# Stage 1: Dependencies
FROM python:3.12-slim AS builder

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# Stage 2: Runtime
FROM python:3.12-slim

WORKDIR /app

# Create non-root user
RUN addgroup --system app && adduser --system --ingroup app app

COPY --from=builder /install /usr/local
COPY backend/ ./backend/

# Create volume mount point for private document storage
RUN mkdir -p /app/storage/private /app/storage/proofs && chown -R app:app /app/storage
VOLUME ["/app/storage/private", "/app/storage/proofs"]

USER app

EXPOSE 8000

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
