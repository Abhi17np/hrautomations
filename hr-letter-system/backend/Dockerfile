FROM python:3.11-slim

# LibreOffice + font tools for PDF conversion
RUN apt-get update && apt-get install -y \
    libreoffice \
    fontconfig \
    fonts-liberation \
    tesseract-ocr \
    tesseract-ocr-eng \
    libgl1 \
    libglib2.0-0 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Windows-compatible fonts
COPY fonts/ /usr/share/fonts/custom/
RUN fc-cache -f -v

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN mkdir -p storage/templates storage/letters

EXPOSE 5000
CMD ["python", "app.py"]