# ===============================
# ベースイメージ
# ===============================
FROM python:3.12-slim

# 作業ディレクトリ
WORKDIR /app

# 出力バッファ無効化
ENV PYTHONUNBUFFERED=1

# ===============================
# 必要パッケージをインストール
# ===============================
RUN apt-get update && apt-get install -y \
    default-libmysqlclient-dev \
    pkg-config \
    build-essential \
    default-mysql-client \
    netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

# ===============================
# Pythonパッケージをインストール
# ===============================
COPY requirements.txt .
RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# ===============================
# アプリケーションをコピー
# ===============================
COPY . .

# 静的ファイル用ディレクトリを作成
RUN mkdir -p /app/staticfiles /app/mediafiles

# ===============================
# Gunicorn でサーバー起動（docker-compose.ymlで上書き可能）
# ===============================
EXPOSE 8000
CMD ["gunicorn", "nasproject.wsgi:application", "--bind", "0.0.0.0:8000"]
