$ErrorActionPreference = 'Stop'
$pushedLocation = $false
$exitCode = 1
$failureMessage = 'Authentication refresh could not finish. Run this helper from Windows PowerShell.'

function Find-RequiredCommand([string] $Name) {
  $command = Get-Command $Name -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $command) {
    $script:failureMessage = "Required command is missing: $Name. Install it manually, then run this script again."
    throw 'MISSING_REQUIRED_COMMAND'
  }
  return $command.Source
}

try {
  if ($env:OS -ne 'Windows_NT') {
    throw 'Run this helper on the Windows PC that owns the Daangn login.'
  }

  $nodeCommand = Find-RequiredCommand 'node'
  $npmCommand = Find-RequiredCommand 'npm.cmd'
  $npxCommand = Find-RequiredCommand 'npx.cmd'
  $ghCommand = Find-RequiredCommand 'gh'

  $failureMessage = 'Node.js 18 or newer is required. Update Node.js manually, then try again.'
  $nodeMajor = & $nodeCommand -p "process.versions.node.split('.')[0]"
  if ($LASTEXITCODE -ne 0 -or [int]$nodeMajor -lt 18) {
    throw 'Node.js 18 or newer is required. Update Node.js manually, then try again.'
  }

  $failureMessage = 'GitHub CLI is not signed in. Run gh auth login, then try again.'
  & $ghCommand auth status *> $null
  if ($LASTEXITCODE -ne 0) {
    throw 'GitHub CLI is not signed in. Run gh auth login, then try again.'
  }

  $failureMessage = 'Cannot open the helper directory. Download all helper files again.'
  Push-Location -LiteralPath $PSScriptRoot
  $pushedLocation = $true

  $failureMessage = 'Dependency installation failed. Check the network and the package files.'
  & $npmCommand ci --ignore-scripts --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }

  $failureMessage = 'Chromium installation failed. Check the network, then try again.'
  & $npxCommand --no-install playwright install chromium
  if ($LASTEXITCODE -ne 0) { throw 'Chromium installation failed.' }

  $failureMessage = 'Daangn login verification failed. The GitHub authentication secret was not changed.'
  & $nodeCommand (Join-Path $PSScriptRoot 'src\refresh-auth.mjs')
  $refreshExitCode = $LASTEXITCODE

  if ($refreshExitCode -eq 10) {
    Write-Host 'Canceled. The GitHub authentication secret was not changed.'
    $exitCode = 0
  } elseif ($refreshExitCode -ne 0) {
    throw 'Daangn login verification failed. The GitHub authentication secret was not changed.'
  } else {
    # The existing helper reads the verified local file and uploads it through stdin.
    # Suppress its old unconditional automation-success message.
    $failureMessage = 'GitHub secret update failed. The verified login file remains on this PC.'
    & (Join-Path $PSScriptRoot 'bootstrap-secret.ps1') *> $null
    if ($LASTEXITCODE -ne 0) { throw 'GitHub secret update failed. The verified login file remains on this PC.' }
    Write-Host 'Daangn login verified and GitHub authentication secret updated.'
    Write-Host 'No post was created. Check the next cloud run to confirm recovery.'
    $exitCode = 0
  }
} catch {
  # Only fixed local status messages are emitted; never print authentication state.
  [Console]::Error.WriteLine($failureMessage)
} finally {
  if ($pushedLocation) { Pop-Location }
}

exit $exitCode
