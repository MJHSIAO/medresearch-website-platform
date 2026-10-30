# syntax=docker/dockerfile:1
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install dependencies separately so content edits can reuse this image layer.
COPY requirements.txt ./
RUN python -m pip install --no-cache-dir -r requirements.txt \
    && groupadd --gid 10001 medresearch \
    && useradd --uid 10001 --gid medresearch --no-create-home medresearch

# Explicit allowlist: never copy .env, certificates, Git history or local tools.
COPY backend/ ./backend/
COPY *.html ./
COPY assets/ ./assets/
COPY data/ ./data/
COPY admin-demo/ ./admin-demo/
COPY ai-center/ ./ai-center/
RUN mkdir -p /app/var && chown 10001:10001 /app/var

USER 10001:10001
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/healthz', timeout=3).close()"]

# The current session store is process-local: use exactly one worker.
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--proxy-headers", "--no-access-log"]
