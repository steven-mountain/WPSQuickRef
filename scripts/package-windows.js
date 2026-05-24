import fs from 'node:fs'
import path from 'node:path'
import {
  ADDIN_DIR,
  ADDIN_NAME,
  APP_VERSION,
  cleanupStage,
  copyDir,
  prepareStage,
  releaseDir,
  writeFile,
  zipStage
} from './package-common.js'

const stageRoot = prepareStage('windows')
const zipPath = path.join(releaseDir, `${ADDIN_NAME}-windows-v${APP_VERSION}.zip`)

const nestedPluginDir = path.join(stageRoot, 'jsaddons', ADDIN_DIR)
const rootPluginDir = path.join(stageRoot, ADDIN_DIR)
fs.rmSync(rootPluginDir, { recursive: true, force: true })
copyDir(nestedPluginDir, rootPluginDir)
fs.rmSync(path.join(stageRoot, 'jsaddons'), { recursive: true, force: true })

writeFile(path.join(stageRoot, 'install.bat'), createInstallBat(), 0o644)
writeFile(path.join(stageRoot, 'uninstall.bat'), createUninstallBat(), 0o644)

zipStage(stageRoot, zipPath)
cleanupStage(stageRoot)
console.log(`Windows package created: ${zipPath}`)

function createInstallBat() {
  return `@echo off
setlocal

echo WPSRefManager installer
echo Please close WPS Office before continuing.
pause

set "PLUGIN_DIR=${ADDIN_DIR}"
set "SOURCE_DIR=%~dp0%PLUGIN_DIR%"
set "ADDON_ROOT=%APPDATA%\\kingsoft\\wps\\jsaddons"
set "TARGET_DIR=%ADDON_ROOT%\\%PLUGIN_DIR%"
set "PUBLISH_FILE=%ADDON_ROOT%\\publish.xml"

echo Source directory: "%SOURCE_DIR%"
echo Addon root: "%ADDON_ROOT%"
echo Target directory: "%TARGET_DIR%"
echo Publish file: "%PUBLISH_FILE%"

if not exist "%SOURCE_DIR%" (
  echo ERROR: Source directory not found.
  pause
  exit /b 1
)

if not exist "%SOURCE_DIR%\\index.html" (
  echo ERROR: index.html not found in source directory.
  pause
  exit /b 1
)

if not exist "%SOURCE_DIR%\\ribbon.xml" (
  echo ERROR: ribbon.xml not found in source directory.
  pause
  exit /b 1
)

if not exist "%ADDON_ROOT%" (
  echo Creating addon root: "%ADDON_ROOT%"
  mkdir "%ADDON_ROOT%"
  if errorlevel 1 (
    echo ERROR: Failed to create addon root.
    pause
    exit /b 1
  )
)

if exist "%TARGET_DIR%" (
  echo Removing old plugin directory: "%TARGET_DIR%"
  rmdir /s /q "%TARGET_DIR%"
  if errorlevel 1 (
    echo ERROR: Failed to remove old plugin directory.
    pause
    exit /b 1
  )
)

echo Copying plugin files...
xcopy "%SOURCE_DIR%" "%TARGET_DIR%" /E /I /Y
if errorlevel 2 (
  echo ERROR: Failed to copy plugin files.
  pause
  exit /b 1
)

if exist "%PUBLISH_FILE%" (
  echo Backing up publish.xml to publish.xml.bak
  copy /Y "%PUBLISH_FILE%" "%PUBLISH_FILE%.bak"
  if errorlevel 1 (
    echo ERROR: Failed to backup publish.xml.
    pause
    exit /b 1
  )
)

echo Writing publish.xml...
> "%PUBLISH_FILE%" (
  echo ^<jsplugins^>
  echo   ^<jsplugin name="WPSRefManager" type="wps" url="%TARGET_DIR%" enable="enable" install="true"/^>
  echo ^</jsplugins^>
)
if errorlevel 1 (
  echo ERROR: Failed to write publish.xml.
  pause
  exit /b 1
)

echo Install completed.
echo Please restart WPS Writer.
pause
exit /b 0
`
}

function createUninstallBat() {
  return `@echo off
setlocal

echo WPSRefManager uninstaller
echo Please close WPS Office before continuing.
pause

set "PLUGIN_DIR=${ADDIN_DIR}"
set "ADDON_ROOT=%APPDATA%\\kingsoft\\wps\\jsaddons"
set "TARGET_DIR=%ADDON_ROOT%\\%PLUGIN_DIR%"
set "PUBLISH_FILE=%ADDON_ROOT%\\publish.xml"

echo Target directory: "%TARGET_DIR%"
echo Publish file: "%PUBLISH_FILE%"

if exist "%TARGET_DIR%" (
  echo Removing plugin directory...
  rmdir /s /q "%TARGET_DIR%"
  if errorlevel 1 (
    echo ERROR: Failed to remove plugin directory.
    pause
    exit /b 1
  )
)

if exist "%PUBLISH_FILE%" (
  echo Backing up publish.xml to publish.xml.bak
  copy /Y "%PUBLISH_FILE%" "%PUBLISH_FILE%.bak"
  > "%PUBLISH_FILE%" (
    echo ^<jsplugins^>
    echo ^</jsplugins^>
  )
)

echo Uninstall completed.
echo Please restart WPS Writer.
pause
exit /b 0
`
}
