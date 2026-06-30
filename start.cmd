@echo off
cd /d "%~dp0"

set NODE_PATH=C:\Users\Admin\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe
set URL=http://localhost:35217

>nul 2>&1 curl -s "%URL%/ping" && exit /b 0

start /min "" "%NODE_PATH%" server.js

for /l %%i in (1,1,10) do (
    >nul 2>&1 curl -s "%URL%/ping" && goto done
    >nul 2>&1 timeout /t 1 /nobreak
)

:done
