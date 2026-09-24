param(
  [Parameter(Mandatory = $true)][string]$KolHandle,
  [ValidateSet('risk-profile', 'exchange-stance', 'token-track-record')]
  [string]$TemplateSlug = 'risk-profile',
  [string]$Prompt
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if ($KolHandle -notmatch '^[A-Za-z0-9_]{1,15}$') { throw 'Use a valid X handle without @.' }
$isDeep = $PSBoundParameters.ContainsKey('Prompt')
if ($isDeep -and $PSBoundParameters.ContainsKey('TemplateSlug')) { throw 'Choose either -Prompt or -TemplateSlug.' }
if ($isDeep -and ($Prompt.Trim().Length -lt 20 -or $Prompt.Trim().Length -gt 2000)) {
  throw 'Prompt must be 20 to 2000 characters.'
}
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
$settingsPath = Join-Path $projectRoot '.env.local'
if (-not (Test-Path -LiteralPath $settingsPath)) { throw '.env.local is missing.' }
$settings = @{}
foreach ($line in Get-Content -LiteralPath $settingsPath) {
  if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
    $settings[$matches[1]] = $matches[2].Trim().Trim('"', "'")
  }
}
if ($settings['PAY_MODE'] -ne 'sandbox') { throw 'This buyer script only accepts PAY_MODE=sandbox.' }
if (-not $settings['SURF_API_KEY'] -or -not $settings['DATABASE_URL']) {
  throw 'Configure SURF_API_KEY and DATABASE_URL in .env.local before a real report purchase.'
}
if (-not $settings['ADMIN_TOKEN']) { throw 'ADMIN_TOKEN is required for the local demo claim.' }

$gatewayUrl = if ($settings['PAY_GATEWAY_URL']) { $settings['PAY_GATEWAY_URL'].TrimEnd('/') } else { 'http://127.0.0.1:1402' }
$gatewayUri = [Uri]$gatewayUrl
if ($gatewayUri.Scheme -ne 'http' -or $gatewayUri.Host -notin @('127.0.0.1', 'localhost')) {
  throw 'Sandbox gateway must be a local HTTP endpoint.'
}
$researchPort = if ($settings['RESEARCH_PORT']) { [int]$settings['RESEARCH_PORT'] } else { 4174 }
$researchUrl = "http://127.0.0.1:$researchPort"
$health = Invoke-RestMethod -Uri "$researchUrl/health" -TimeoutSec 5
if (-not ($health.enabled -and $health.gatewayMode -and $health.surfConfigured -and $health.databaseConfigured)) {
  throw 'Research sidecar is not ready for a paid report.'
}
$gatewayHealth = Invoke-WebRequest -Uri "$gatewayUrl/__402/health" -TimeoutSec 5 -SkipHttpErrorCheck
if ([int]$gatewayHealth.StatusCode -ne 200) { throw 'pay.sh sandbox gateway is not ready.' }

$gitTools = 'C:\Program Files\Git\usr\bin'
if (Test-Path -LiteralPath (Join-Path $gitTools 'which.exe')) { $env:PATH = "$gitTools;$env:PATH" }
$accountOutput = (& npx --yes @solana/pay@1.0.26 --sandbox --no-dna account list 2>&1) -join "`n"
if ($LASTEXITCODE -ne 0) { throw 'Could not read the sandbox buyer wallet.' }
$accountOutput = $accountOutput -replace '\x1B\[[0-9;]*[A-Za-z]', ''
$buyerMatch = [regex]::Match($accountOutput, 'default\s+\[localnet\s+([1-9A-HJ-NP-Za-km-z]{32,44})\]')
$signerMatch = [regex]::Match($accountOutput, 'gateway\s+\[localnet\s+([1-9A-HJ-NP-Za-km-z]{32,44})\]')
if (-not $buyerMatch.Success -or -not $signerMatch.Success) { throw 'Sandbox buyer or gateway signer was not found.' }
$buyerWallet = $buyerMatch.Groups[1].Value
$gatewaySigner = $signerMatch.Groups[1].Value
if ($settings['PAY_GATEWAY_SIGNER_WALLET'] -ne $gatewaySigner) {
  throw 'Set PAY_GATEWAY_SIGNER_WALLET from `pay --sandbox account list` in .env.local and restart the research sidecar.'
}

$route = if ($isDeep) { 'research/deep' } else { 'research/quick' }
$payload = if ($isDeep) {
  @{ kolHandle = $KolHandle; prompt = $Prompt.Trim(); buyerWallet = $buyerWallet } | ConvertTo-Json -Compress
} else {
  @{ kolHandle = $KolHandle; templateSlug = $TemplateSlug; buyerWallet = $buyerWallet } | ConvertTo-Json -Compress
}
$raw = & npx --yes @solana/pay@1.0.26 --sandbox --no-dna curl -i -sS -X POST -H 'Content-Type: application/json' -d $payload "$gatewayUrl/$route" 2>&1
if ($LASTEXITCODE -ne 0) { throw 'pay.sh CLI purchase failed.' }
$status = ($raw | Where-Object { $_ -match '^HTTP/\S+\s+\d{3}' } | Select-Object -Last 1)
if ($status -notmatch '\s201\s') { throw "Gateway did not create a report: $status" }
$receiptHeader = if ($isDeep) { 'PAYMENT-RESPONSE' } else { 'Payment-Receipt' }
$receiptLine = $raw | Where-Object { $_ -match "^(?i:$receiptHeader):\s*" } | Select-Object -Last 1
if (-not $receiptLine) { throw "Paid response contained no $receiptHeader header." }
$receipt = ($receiptLine -replace '^[^:]+:\s*', '').Trim()
$reportLine = $raw | Where-Object { $_ -match '^\{.*"reportId"' } | Select-Object -Last 1
if (-not $reportLine) { throw 'Paid response contained no report ID.' }
$report = $reportLine | ConvertFrom-Json
if ($report.reportId -notmatch '^[0-9a-f-]{36}$') { throw 'Paid response had an invalid report ID.' }
$protocol = if ($isDeep) { 'x402-upto' } else { 'mpp-session' }
Write-Host "Purchased report $($report.reportId) for @$KolHandle with sandbox $protocol."

$claimBody = @{ protocol = $protocol; receipt = $receipt } | ConvertTo-Json -Compress
$claimHeaders = @{ Authorization = "Bearer $($settings['ADMIN_TOKEN'])" }
$claim = $null
for ($attempt = 0; $attempt -lt 12; $attempt++) {
  $claimResponse = Invoke-WebRequest -Uri "$researchUrl/reports/$($report.reportId)/payment" -Method POST -ContentType 'application/json' -Headers $claimHeaders -Body $claimBody -SkipHttpErrorCheck -TimeoutSec 15
  if ([int]$claimResponse.StatusCode -eq 200) {
    $claim = $claimResponse.Content | ConvertFrom-Json
    break
  }
  if ([int]$claimResponse.StatusCode -ne 202) { throw "Receipt verification failed: HTTP $([int]$claimResponse.StatusCode)." }
  Start-Sleep -Seconds 3
}
if (-not $claim) { throw 'Payment did not settle within the demo window; retry receipt claim later.' }
$channelNote = if ($claim.channel) { " Channel $($claim.channel.status), remaining $($claim.channel.remainingUsdc)." } else { '' }
Write-Host "Payment verified: $($claim.priceChargedUsdc) sandbox USDC.$channelNote"

$verification = $null
for ($attempt = 0; $attempt -lt 10; $attempt++) {
  $verification = Invoke-RestMethod -Uri "$researchUrl/reports/$($report.reportId)/verify" -TimeoutSec 15
  if ($verification.recomputedHashMatch -and $verification.onChainMatch) { break }
  Start-Sleep -Seconds 3
}
if (-not ($verification.recomputedHashMatch -and $verification.onChainMatch)) {
  throw "Report $($report.reportId) was paid, but its devnet Memo is still pending or mismatched."
}
Write-Host "Report: http://127.0.0.1:5173/reports/$($report.reportId)"
Write-Host "Devnet Memo: $($verification.explorerUrl)"
