# Backend Dockerfile
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install system dependencies
# - gcc, libpq-dev: psycopg2 / compiled extensions
# - libxml2-dev, libxslt1-dev: lxml (cliente AFIP SOAP)
# - libcairo2, libpango-1.0-0, libpangoft2-1.0-0, libharfbuzz0b, libffi-dev,
#   shared-mime-info, fonts-dejavu: WeasyPrint (PDF facturas)
# - libssl-dev: firma CMS AFIP
# - openssl: util para diagnosticar / generar CSR
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    libxml2-dev \
    libxslt1-dev \
    libssl-dev \
    libffi-dev \
    libcairo2 \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libharfbuzz0b \
    shared-mime-info \
    fonts-dejavu \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Default command - Railway injects PORT env variable
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
