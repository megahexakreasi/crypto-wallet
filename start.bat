@echo off
title EVM Local Web Wallet - Runner
cd /d "%~dp0"

echo ==========================================================
echo        EVM LOCAL WEB WALLET (ETH, BSC ^& MTT NETWORK)
echo ==========================================================
echo.

:: 1. Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js tidak ditemukan!
    echo Silakan install Node.js terlebih dahulu dari https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: 2. Check node_modules
if not exist "node_modules\" (
    echo [INFO] Folder node_modules belum ada. Menginstal dependensi...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Gagal menginstal dependensi!
        pause
        exit /b 1
    )
    echo.
)

:: 3. Inform URLs
echo [OK] Server Web Wallet sedang dijalankan...
echo.
echo ----------------------------------------------------------
echo Akses di PC ini:
echo   --^> http://localhost:5173/
echo.
echo Akses dari HP/Tablet (Wi-Fi yang sama):
echo   --^> http://192.168.1.5:5173/
echo ----------------------------------------------------------
echo.
echo Membuka browser default otomatis...
timeout /t 2 /nobreak >nul
start http://localhost:5173/

echo.
echo Tekan Ctrl + C untuk menghentikan server.
echo.

:: 4. Start Vite dev server
call npm run dev

pause
