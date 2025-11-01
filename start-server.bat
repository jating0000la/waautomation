@echo off
SETLOCAL ENABLEDELAYEDEXPANSION
echo ==========================================
echo   WhatsApp Automation API - Starter
echo ==========================================

IF NOT EXIST node_modules ( 
	echo [*] Installing dependencies...
	call npm install || ( echo [X] npm install failed & exit /b 1 )
) ELSE (
	echo [*] Dependencies already installed.
)

IF NOT EXIST .env (
	echo [!] .env file not found. Create one with DATABASE_URL and PORT variables.
)

echo [*] Starting server...
call npm start

ENDLOCAL
