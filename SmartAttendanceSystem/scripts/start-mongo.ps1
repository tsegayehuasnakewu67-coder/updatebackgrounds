$s = Get-Service -Name MongoDB -ErrorAction SilentlyContinue
if ($null -ne $s) {
  if ($s.Status -ne 'Running') {
    Start-Service -Name $s.Name -ErrorAction SilentlyContinue
  }
  $s = Get-Service -Name $s.Name -ErrorAction SilentlyContinue
  $s | Select-Object Name,Status,DisplayName | Format-List
} else {
  $s2 = Get-Service -Name mongodb -ErrorAction SilentlyContinue
  if ($null -ne $s2) {
    if ($s2.Status -ne 'Running') {
      Start-Service -Name $s2.Name -ErrorAction SilentlyContinue
    }
    $s2 = Get-Service -Name $s2.Name -ErrorAction SilentlyContinue
    $s2 | Select-Object Name,Status,DisplayName | Format-List
  } else {
    Write-Host '---NO_MONGO_SERVICE_FOUND---'
  }
}
