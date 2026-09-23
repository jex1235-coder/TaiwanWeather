@echo off
cd /d "%~dp0"

where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python was not found in PATH.
    echo Please install Python and ensure it is added to environment variables.
    pause
    exit /b 1
)

python run.py %*
if %errorlevel% neq 0 (
    pause
)
