@echo off
setlocal
title All Downloader
cd /d "%~dp0"
chcp 65001 >nul

powershell -NoProfile -ExecutionPolicy Bypass -Command "$e=[char]27; $title='>>> A L L   D O W N L O A D E R <<<' ; for($i=0;$i -lt $title.Length;$i++){ $angle=[int](($i*360)/[Math]::Max(1,$title.Length)); $r=[int](127.5+127.5*[Math]::Sin($angle*[Math]::PI/180)); $g=[int](127.5+127.5*[Math]::Sin(($angle+120)*[Math]::PI/180)); $b=[int](127.5+127.5*[Math]::Sin(($angle+240)*[Math]::PI/180)); [Console]::Write($e+'[38;2;'+$r+';'+$g+';'+$b+'m'+$title[$i]) }; [Console]::WriteLine($e+'[0m'); Write-Host ''; Write-Host '  [ MEDIA DOWNLOADER // SYSTEM ONLINE ]' -ForegroundColor Cyan; Write-Host ''"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install Node.js, then run this file again.
  pause
  exit /b 1
)

if not exist "%~dp0node_modules\next\package.json" (
  echo Installing app dependencies...
  call npm install
  if errorlevel 1 (
    echo Dependency installation failed.
    pause
    exit /b 1
  )
)

for /f "delims=" %%P in ('powershell -NoProfile -Command "$listener=[System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback,0); $listener.Start(); $port=$listener.LocalEndpoint.Port; $listener.Stop(); Write-Output $port"') do set "PORT=%%P"
if not defined PORT (
  echo Could not find an available local port.
  pause
  exit /b 1
)

set "URL=http://127.0.0.1:%PORT%"
echo Starting the downloader at %URL%
start "All Downloader Server" /D "%~dp0" cmd /k "npm run dev -- --hostname 127.0.0.1 --port %PORT%"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$url='%URL%'; $ready=$false; for($i=0;$i -lt 60;$i++){ try{$r=Invoke-WebRequest -Uri $url -TimeoutSec 2 -UseBasicParsing; if($r.StatusCode -ge 200){$ready=$true; break}}catch{}; Start-Sleep -Seconds 1 }; if($ready){Write-Host 'Server is ready. Opening your browser...' -ForegroundColor Green; Start-Process $url; exit 0}; Write-Error 'The server did not start in time. Check the All Downloader Server window.'; exit 1"
if errorlevel 1 (
  echo The server may still be starting. Check the All Downloader Server window.
) else (
  echo Your browser is opening %URL%
)
echo Keep the All Downloader Server window open while using the app.
pause
