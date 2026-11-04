# Issue #950: LOCAL, READ-ONLY owner-operated source PDF preflight.
# NO network request, JWT, key, browser operation, Storage GET/PUT, SQL or
# cloud project mutation. The owner must keep the PDF on a protected device.
# This does NOT certify the live Restore project or authorize a Storage upload.
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$SourcePdf,
  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$DestinationProjectRef
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$expectedProject = 'movnekagnxgcyenczfoc'
$expectedSize = [long]2281645
$expectedSha256 = 'b96bf8cdc90a69112f367ef66dafe30b1e0fc2402edc43f249d8525db9fe3666'

if (-not [string]::Equals($DestinationProjectRef, $expectedProject, [System.StringComparison]::Ordinal)) {
  throw 'STOP: destination project ref is not the isolated restore'
}
if (-not (Test-Path -LiteralPath $SourcePdf -PathType Leaf)) {
  throw 'STOP: local PDF source file is missing'
}
$file = Get-Item -LiteralPath $SourcePdf
if ($file -isnot [System.IO.FileInfo] -or $file.Extension.ToLowerInvariant() -cne '.pdf') {
  throw 'STOP: expected one local PDF file'
}
if ([long]$file.Length -ne $expectedSize) {
  throw 'STOP: PDF size mismatch'
}
$observedSha256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
if ($observedSha256 -cne $expectedSha256) {
  throw 'STOP: PDF SHA256 mismatch'
}

# No path, filename, media bytes or local user identity in successful output.
Write-Output 'ISSUE950_LOCAL_SOURCE_SHA256_PASS'
Write-Output 'ISSUE950_DESTINATION_PARAMETER_PIN_PASS'
Write-Output 'ISSUE950_NO_NETWORK_OR_WRITE_ACTION_PERFORMED'
Write-Output 'ISSUE950_LIVE_RESTORE_STILL_NO_GO'
