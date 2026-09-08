@echo off
chcp 65001 >nul 2>&1
title Sound Training - One Click Start

echo ================================
echo   Sound Training System
echo ================================
echo.

python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Please install Python 3 first.
    echo Download: https://www.python.org/downloads/
    echo.
    pause
    exit /b 1
)
echo [OK] Python ready

set "VENV=%~dp0.venv"

if not exist "%VENV%\Scripts\python.exe" (
    echo.
    echo ================================
    echo   First Run - Setting Up...
    echo ================================
    echo.
    echo [1/2] Creating virtual environment...
    python -m venv "%VENV%"
    if errorlevel 1 (
        echo [ERROR] Failed to create venv.
        pause
        exit /b 1
    )
    echo [OK] Virtual environment created

    echo.
    echo [2/2] Installing dependencies...
    call "%VENV%\Scripts\activate.bat"
    pip install -r "%~dp0requirements.txt" -i https://pypi.tuna.tsinghua.edu.cn/simple
    if errorlevel 1 (
        echo [WARN] Tsinghua mirror failed, trying default...
        pip install -r "%~dp0requirements.txt"
        if errorlevel 1 (
            echo [ERROR] Failed to install dependencies.
            pause
            exit /b 1
        )
    )
    echo [OK] Dependencies installed
    echo.
    echo ================================
    echo   Setup Complete!
    echo ================================
    echo.
) else (
    call "%VENV%\Scripts\activate.bat"
    echo [OK] Environment ready, starting...
    echo.
)

start "Sound Training Server" cmd /c "cd /d "%~dp0" && title Sound Training - Server && "%VENV%\Scripts\python.exe" app.py"

echo Waiting for server to start...
timeout /t 3 /nobreak >nul

start http://127.0.0.1:5000

echo.
echo ================================
echo   Server is running!
echo.
echo   Home:   http://127.0.0.1:5000
echo   C Major: http://127.0.0.1:5000/c_major_scale
echo   Scale:   http://127.0.0.1:5000/natural_scale_training
echo   Free:    http://127.0.0.1:5000/free_training
echo   Piano:   http://127.0.0.1:5000/piano_test
echo.
echo   Close "Sound Training - Server" window to stop.
echo ================================
echo.
pause
