# ─────────────────────────────────────────────────────────────────
# Download face-api.js model weights into public/models/
# Run this once from the frontEnd directory:
#   powershell -ExecutionPolicy Bypass -File .\download-models.ps1
# ─────────────────────────────────────────────────────────────────

$BASE = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights"
$OUT  = "$PSScriptRoot\public\models"

# Create output directory if it doesn't exist
New-Item -ItemType Directory -Force -Path $OUT | Out-Null

$files = @(
  # ── Tiny Face Detector ────────────────────────────────────
  "tiny_face_detector_model-weights_manifest.json",
  "tiny_face_detector_model-shard1",

  # ── Face Landmark 68 ──────────────────────────────────────
  "face_landmark_68_model-weights_manifest.json",
  "face_landmark_68_model-shard1",

  # ── Face Recognition ──────────────────────────────────────
  "face_recognition_model-weights_manifest.json",
  "face_recognition_model-shard1",
  "face_recognition_model-shard2"
)

$total = $files.Count
$i = 0

foreach ($file in $files) {
  $i++
  $url  = "$BASE/$file"
  $dest = "$OUT\$file"
  Write-Host "[$i/$total] Downloading $file ..." -ForegroundColor Cyan
  try {
    Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing
    Write-Host "  ✅ OK" -ForegroundColor Green
  } catch {
    Write-Host "  ❌ FAILED: $_" -ForegroundColor Red
  }
}

Write-Host ""
Write-Host "──────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host "Done! Verify files exist:" -ForegroundColor Yellow
Get-ChildItem $OUT | ForEach-Object { Write-Host "  $($_.Name)" -ForegroundColor White }
Write-Host ""
Write-Host "Now restart: npm run dev" -ForegroundColor Green
