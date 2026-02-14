@echo off
REM Dynamically find CUDA DLL paths from Python packages (handles namespace packages safely)
for /f "delims=" %%i in ('python -c "import importlib.util,os;paths=[];[paths.append(os.path.join(os.path.dirname(s.origin),d)) for p,d in [('torch','lib')] for s in [importlib.util.find_spec(p)] if s and s.origin];[paths.append(loc) for s in [importlib.util.find_spec('nvidia.cuda_nvrtc')] if s and s.submodule_search_locations for loc in s.submodule_search_locations];print(os.pathsep.join([p for p in paths if os.path.isdir(p)]))" 2^>nul') do set "CUDA_PATHS=%%i"
if defined CUDA_PATHS set "PATH=%CUDA_PATHS%;%PATH%"

REM Run the generated script from the output folder
if "%~1"=="" (
    echo Usage: run_output.bat filename.py
    echo Example: run_output.bat main.py
    echo.
    echo Available files in output/:
    dir /b output\*.py 2>nul
    dir /b output\*.js 2>nul
    exit /b 1
)

echo Running output\%~1...
echo ============================================
set "PYTHONPATH=output"
python output\%~1
