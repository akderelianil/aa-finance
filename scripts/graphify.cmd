@echo off
rem graphify.exe is blocked by Application Control; run the module with the uv tool Python instead.
"%APPDATA%\uv\tools\graphifyy\Scripts\python.exe" -m graphify %*
