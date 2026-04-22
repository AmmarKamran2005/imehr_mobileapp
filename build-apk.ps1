# build-apk.ps1 — one-shot debug APK build from the repo root.
#
# Runs: Angular production build → Capacitor sync → Gradle debug APK
# Output: android\app\build\outputs\apk\debug\app-debug.apk
#
# Requires Android Studio installed at the default path for the embedded
# JBR 21. Override JAVA_HOME before invoking if your layout differs.

$ErrorActionPreference = 'Stop'

# ---------- Toolchain pinning ----------
$jbr = 'C:\Program Files\Android\Android Studio\jbr'
if (-not (Test-Path $jbr)) {
  Write-Error "JBR not found at $jbr. Install Android Studio or set JAVA_HOME manually."
}
$env:JAVA_HOME = $jbr
$env:PATH = "$jbr\bin;$env:PATH"

# ---------- Gradle temp-dir workaround for Windows UDS pipe bug ----------
if (-not (Test-Path 'C:\gradle-tmp')) {
  New-Item -ItemType Directory -Path 'C:\gradle-tmp' | Out-Null
}
$env:TEMP = 'C:\gradle-tmp'
$env:TMP  = 'C:\gradle-tmp'

Write-Host "== 1/3 Angular production build =="
npx ng build --configuration=production
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n== 2/3 Capacitor sync =="
npx cap sync android
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n== 3/3 Gradle assembleDebug =="
Push-Location android
try {
  & .\gradlew.bat assembleDebug --no-daemon
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
  Pop-Location
}

$apk = 'android\app\build\outputs\apk\debug\app-debug.apk'
if (Test-Path $apk) {
  $size = [math]::Round((Get-Item $apk).Length / 1MB, 1)
  Write-Host "`nAPK ready at $apk ($size MB)" -ForegroundColor Green
} else {
  Write-Error "Build reported success but APK is missing at $apk"
}
