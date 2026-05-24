import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export const APP_VERSION = '1.0.0'
export const ADDIN_NAME = 'WPSRefManager'
export const ADDIN_DISPLAY_NAME = '书签引用管理器'
export const ADDIN_DIR = `${ADDIN_NAME}_${APP_VERSION}`

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
export const rootDir = path.resolve(__dirname, '..')
export const distDir = path.join(rootDir, 'dist')
export const releaseDir = path.join(rootDir, 'release')

export function assertBuildExists() {
  const required = ['index.html', 'manifest.xml', 'ribbon.xml', 'assets']
  const missing = required.filter((item) => !fs.existsSync(path.join(distDir, item)))
  if (missing.length) {
    throw new Error(`dist 缺少必要文件：${missing.join(', ')}。请先运行 npm run build。`)
  }
}

export function prepareStage(platform) {
  assertBuildExists()
  const stageRoot = path.join(releaseDir, `.stage-${platform}`)
  fs.rmSync(stageRoot, { recursive: true, force: true })
  fs.mkdirSync(stageRoot, { recursive: true })

  const jsaddonsDir = path.join(stageRoot, 'jsaddons')
  const pluginDir = path.join(jsaddonsDir, ADDIN_DIR)
  fs.mkdirSync(jsaddonsDir, { recursive: true })
  copyDir(distDir, pluginDir)
  fs.writeFileSync(path.join(jsaddonsDir, 'publish.xml'), createPublishXml(), 'utf8')
  fs.writeFileSync(path.join(stageRoot, 'README.md'), createPackageReadme(platform), 'utf8')
  return stageRoot
}

export function createPublishXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<jsplugins>
  <jsplugin name="${ADDIN_NAME}" type="wps" url="${ADDIN_DIR}" version="${APP_VERSION}" enable="enable_dev" install="null" customDomain=""/>
</jsplugins>
`
}

export function createPackageReadme(platform) {
  const title = platform === 'windows' ? 'Windows 离线安装包' : 'macOS 离线安装包'
  return `# ${ADDIN_DISPLAY_NAME} ${title}

版本：${APP_VERSION}

安装前请先完全退出 WPS Office。

## 安装

${platform === 'windows' ? '双击 `install.bat`。' : '双击 `install.command`；如果系统提示无权限，在终端执行 `chmod +x install.command uninstall.command` 后再运行。'}

## 卸载

${platform === 'windows' ? '双击 `uninstall.bat`。' : '双击 `uninstall.command`。'}

安装脚本会备份已有 publish.xml，并合并 ${ADDIN_NAME} 配置，不会覆盖其他 WPS 加载项配置。
`
}

export function copyDir(source, target) {
  fs.mkdirSync(target, { recursive: true })
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name)
    const targetPath = path.join(target, entry.name)
    if (entry.isDirectory()) {
      copyDir(sourcePath, targetPath)
    } else {
      fs.copyFileSync(sourcePath, targetPath)
    }
  }
}

export function writeFile(target, content, mode) {
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, content, 'utf8')
  if (mode) {
    fs.chmodSync(target, mode)
  }
}

export function zipStage(stageRoot, zipPath) {
  fs.rmSync(zipPath, { force: true })
  fs.mkdirSync(path.dirname(zipPath), { recursive: true })

  if (process.platform === 'win32') {
    const psStageRoot = stageRoot.replace(/"/g, '`"')
    const psZipPath = zipPath.replace(/"/g, '`"')
    const command = `
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
$stage = "${psStageRoot}"
$zip = "${psZipPath}"
if (Test-Path $zip) { Remove-Item $zip -Force }
$archive = [System.IO.Compression.ZipFile]::Open($zip, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  Get-ChildItem -LiteralPath $stage -Recurse -File | ForEach-Object {
    $relative = $_.FullName.Substring($stage.Length + 1).Replace('\\', '/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $_.FullName, $relative) | Out-Null
  }
} finally {
  $archive.Dispose()
}
`
    execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command], {
      stdio: 'inherit'
    })
    return
  }

  execFileSync('zip', ['-r', zipPath, '.'], {
    cwd: stageRoot,
    stdio: 'inherit'
  })
}

export function cleanupStage(stageRoot) {
  fs.rmSync(stageRoot, { recursive: true, force: true })
}
