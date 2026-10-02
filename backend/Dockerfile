# Garg Jewellers API — production image.
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# System deps for psycopg2 (Postgres) at build time.
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Uploaded product images persist via a mounted volume (see docker-compose).
RUN mkdir -p uploads

EXPOSE 8000

# Apply DB migrations, then serve with gunicorn + uvicorn workers.
# Worker count defaults to 2 (fits the 512MB free tier); override via WEB_CONCURRENCY.
# $PORT is provided by the host (Render); falls back to 8000 locally.
CMD ["sh", "-c", "alembic upgrade head && gunicorn app.main:app -k uvicorn.workers.UvicornWorker -w ${WEB_CONCURRENCY:-2} -b 0.0.0.0:${PORT:-8000}"]
