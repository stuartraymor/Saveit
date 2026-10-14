@echo off
title Reinstall Saveit
echo Reinstalling Saveit (your library and settings are kept)...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall.ps1" -Keep
if exist "%~dp0install.ps1" (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
) else (
  echo.
  echo To reinstall, run Install.cmd from the original Saveit folder.
  pause
)
