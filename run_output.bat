@echo off
REM Add CUDA DLL paths so CuPy/CUDA can find runtime libraries
set PATH=C:\Users\user\anaconda3\Lib\site-packages\torch\lib;C:\Users\user\anaconda3\Lib\site-packages\nvidia\cuda_nvrtc\bin;%PATH%

REM Run the generated script from the output folder
if "%~1"=="" (
    echo Usage: run_output.bat filename.py
    echo Example: run_output.bat main.py
    echo.
    echo Available files in output/:
    dir /b output\*.py 2>nul
    dir /b output\*.js 2>nul
    dir /b output\*.go 2>nul
    exit /b 1
)

echo Running output\%~1 on NVIDIA GTX 1080 Ti...
echo ============================================
python output\%~1
