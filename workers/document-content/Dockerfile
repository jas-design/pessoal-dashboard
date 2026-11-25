FROM python:3.12-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends poppler-utils tesseract-ocr tesseract-ocr-por tesseract-ocr-eng && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY extract.py server.py ./
ENV PYTHONDONTWRITEBYTECODE=1 OMP_THREAD_LIMIT=1
USER 10001:10001
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8788/health', timeout=3)"
CMD ["python", "server.py"]
