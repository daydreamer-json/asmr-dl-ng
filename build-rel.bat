@echo off&cd /d %~dp0

set "ISCC_PATH=C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
set VERSION_NUM=1.0.3

mkdir build\asmr-dl-ng
@rem xcopy bin build\asmr-dl-ng\bin /E /I /Q
copy asmr-dl-ng.exe build\asmr-dl-ng
cd build
7z a -tzip -mx=8 asmr-dl-ng_win_x64_%VERSION_NUM%.zip asmr-dl-ng
cd ..
"%ISCC_PATH%" setup\main.iss
rmdir /s /q build\asmr-dl-ng
