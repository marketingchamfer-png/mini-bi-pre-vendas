@echo off
rem ==========================================================
rem  Mini BI de Pre-Vendas - Chamfer
rem  Duplo clique: atualiza o dashboard.html e abre o painel.
rem  Agendador de Tarefas: use o argumento /silencioso
rem ==========================================================
setlocal
chcp 65001 >nul
pushd "%~dp0"

set "PYEXE="
set "PYARGS="
for %%V in (313 312 311 310) do (
  if not defined PYEXE if exist "%LOCALAPPDATA%\Programs\Python\Python%%V\python.exe" set "PYEXE=%LOCALAPPDATA%\Programs\Python\Python%%V\python.exe"
)
if not defined PYEXE (
  where py >nul 2>&1 && (set "PYEXE=py" & set "PYARGS=-3")
)
if not defined PYEXE (
  python -c "import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)" >nul 2>&1 && set "PYEXE=python"
)
if not defined PYEXE (
  echo.
  echo ERRO: Python 3.10 ou mais novo nao foi encontrado neste computador.
  echo Instale com:  winget install Python.Python.3.12
  echo Depois rode:  python -m pip install pandas openpyxl
  set "RC=9"
  goto fim
)

echo Atualizando o Mini BI de Pre-Vendas...
"%PYEXE%" %PYARGS% "%~dp0atualizar_dashboard.py"
set "RC=%ERRORLEVEL%"

if "%RC%"=="0" (
  echo.
  echo Painel atualizado com sucesso.
  if /I not "%~1"=="/silencioso" if exist "%~dp0dashboard.html" start "" "%~dp0dashboard.html"
) else (
  echo.
  echo A atualizacao falhou ^(codigo %RC%^). O painel anterior foi mantido.
  echo Veja os detalhes em atualizacao.log
)

:fim
popd
if /I not "%~1"=="/silencioso" pause
exit /b %RC%
