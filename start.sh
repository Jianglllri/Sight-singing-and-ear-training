#!/usr/bin/env bash
# macOS / Linux 一键启动脚本
set -e
cd "$(dirname "$0")"

if [ ! -d ".venv" ]; then
    echo "首次运行，创建虚拟环境并安装依赖..."
    python3 -m venv .venv
    ./.venv/bin/pip install -r requirements.txt
fi

exec ./.venv/bin/python app.py
