# Issue #950 REVIEW-ONLY, NO-NETWORK Windows REST request-envelope preflight.
# Does not create a token, read keys, open an HTTP connection, or upload/download.
# A matching request plan is NOT proof of a live RLS/JWT/rollback-safe client.
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
$origin = 'https://movnekagnxgcyenczfoc.supabase.co'
$bucket = 'library-pass-books'
$objectKey = 'book/read-the-dollar-first/edition-1.3/USD_Impact_Read_the_Dollar_First_Edition_1.3_v5.95_Phase2C_Scoped_Candidate_2.pdf'
$expectedLength = [long]2281645
$expectedSha256 = 'b96bf8cdc90a69112f367ef66dafe30b1e0fc2402edc43f249d8525db9fe3666'

if (-not [string]::Equals($DestinationProjectRef,$expectedProject,[System.StringComparison]::Ordinal)) {
  throw 'STOP: non-restore project'
}
# Never permit a broad privileged-key environment in the owner operator process.
# These existence checks DO NOT read, print, or transmit any key values.
foreach ($name in @('SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SECRET_KEY','SUPABASE_JWT_SECRET','AWS_SECRET_ACCESS_KEY')) {
  if (Test-Path -LiteralPath ('Env:' + $name)) {
    throw 'STOP: broad credential environment variable is present'
  }
}
if (-not (Test-Path -LiteralPath $SourcePdf -PathType Leaf)) {
  throw 'STOP: original PDF unavailable'
}
$file = Get-Item -LiteralPath $SourcePdf
if ($file -isnot [System.IO.FileInfo] -or $file.Extension.ToLowerInvariant() -cne '.pdf') {
  throw 'STOP: original file type mismatch'
}
if ([long]$file.Length -ne $expectedLength) {
  throw 'STOP: original PDF byte length mismatch'
}
if ((Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant() -cne $expectedSha256) {
  throw 'STOP: original PDF hash mismatch'
}

# These are immutable examples of future REST request destinations, not calls.
# A future protected client must refuse redirects and never accept alternate
# project, bucket, object key, protocol, port, query or fragment from the user.
$paths = @(
  '/storage/v1/object/' + $bucket + '/' + $objectKey,
  '/storage/v1/object/authenticated/' + $bucket + '/' + $objectKey
)
foreach ($path in $paths) {
  $uri = [System.Uri]::new($origin + $path)
  if ($uri.Scheme -cne 'https' -or $uri.Host -cne ($expectedProject + '.supabase.co') -or
      -not $uri.IsDefaultPort -or $uri.AbsolutePath -cne $path -or
      $uri.Query.Length -ne 0 -or $uri.Fragment.Length -ne 0) {
    throw 'STOP: REST endpoint envelope mismatch'
  }
}
# HttpClientHandler is part of Windows PowerShell's existing .NET installation.
# Instantiate and immediately dispose it WITHOUT instantiating a requester.
# A later authorized client must enforce non-followed redirects at both calls.
Add-Type -AssemblyName System.Net.Http
$handler = [System.Net.Http.HttpClientHandler]::new()
try {
  $handler.AllowAutoRedirect = $false
  if ($handler.AllowAutoRedirect) {
    throw 'STOP: redirect blocking unavailable'
  }
} finally {
  $handler.Dispose()
}

Write-Output 'ISSUE950_LOCAL_REST_REQUEST_ENVELOPE_PASS'
Write-Output 'ISSUE950_NO_BROAD_SECRET_VARIABLES_PRESENT'
Write-Output 'ISSUE950_REDIRECT_BLOCKING_AVAILABLE'
Write-Output 'ISSUE950_NO_NETWORK_JWT_OR_STORAGE_WRITE_PERFORMED'
Write-Output 'ISSUE950_LIVE_RESTORE_STILL_NO_GO'
