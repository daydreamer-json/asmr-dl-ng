@echo off&cd /d %~dp0

set "ISCC_PATH=C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
set VERSION_NUM=1.2.4

mkdir build\asmr-dl-ng
xcopy bin build\asmr-dl-ng\bin /E /I /Q
copy asmr-dl-ng.exe build\asmr-dl-ng
cd build
7z a -tzip -mx=8 asmr-dl-ng_win_x64_%VERSION_NUM%.zip asmr-dl-ng

cd ..
"%ISCC_PATH%" setup\main.iss

del build\asmr-dl-ng\asmr-dl-ng.exe
rmdir /s /q build\asmr-dl-ng\bin
copy asmr-dl-ng-linux-x64 build\asmr-dl-ng\asmr-dl-ng
cd build
7z a -tzip -mx=8 asmr-dl-ng_linux_x64_%VERSION_NUM%.zip asmr-dl-ng

cd ..
rmdir /s /q build\asmr-dl-ng
