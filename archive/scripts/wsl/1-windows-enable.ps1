# Run in an ELEVATED PowerShell (Run as administrator). Enables WSL2 and installs Ubuntu 24.04.
# A reboot is needed after the features are enabled; run this script again after the reboot.
$ErrorActionPreference = 'Stop'
$features = 'Microsoft-Windows-Subsystem-Linux', 'VirtualMachinePlatform'
$reboot = $false
foreach ($f in $features) {
  if ((Get-WindowsOptionalFeature -Online -FeatureName $f).State -ne 'Enabled') {
    $r = Enable-WindowsOptionalFeature -Online -FeatureName $f -NoRestart
    if ($r.RestartNeeded) { $reboot = $true }
  }
}
if ($reboot) { Write-Host 'Reboot Windows, then run this script again.'; exit 0 }
wsl --update
wsl --set-default-version 2
if (-not (wsl -l -q | Select-String 'Ubuntu-24.04')) { wsl --install -d Ubuntu-24.04 --no-launch }
Write-Host 'Done. Launch Ubuntu once (wsl -d Ubuntu-24.04) to create your Linux user, then run scripts/wsl/2-linux-bootstrap.sh inside it.'
