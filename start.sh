#!/usr/bin/env bash
# macOS / Linux 一键启动脚本
set -e
cd "$(dirname "$0")"

VENV_DIR=".venv"
PYTHON_BIN="$VENV_DIR/bin/python"
PIP_BIN="$VENV_DIR/bin/pip"
REQ_STAMP="$VENV_DIR/.requirements.stamp"

# 1. 准备虚拟环境
if [ ! -x "$PYTHON_BIN" ]; then
    echo "首次运行，创建虚拟环境..."
    python3 -m venv "$VENV_DIR"
    rm -f "$REQ_STAMP"
fi

# 2. 依赖有变化时安装/更新（避免旧环境不随 requirements.txt 更新）
current_hash="$(cat requirements.txt | (shasum 2>/dev/null || md5sum 2>/dev/null || cksum) | awk '{print $1}')"
if [ ! -f "$REQ_STAMP" ] || [ "$(cat "$REQ_STAMP" 2>/dev/null)" != "$current_hash" ]; then
    echo "安装 / 更新依赖..."
    "$PIP_BIN" install -r requirements.txt
    echo "$current_hash" > "$REQ_STAMP"
fi

# 3. 启动 Flask（默认 http://127.0.0.1:5000）
exec "$PYTHON_BIN" app.py
