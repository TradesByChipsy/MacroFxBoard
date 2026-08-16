@echo off
title Macro FX Decision Board
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0board-server.ps1"
pause
