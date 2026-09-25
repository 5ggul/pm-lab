$ErrorActionPreference = 'Stop'
$Repo = '5ggul/pm-lab'
$AuthPath = 'C:\Users\dhkim\DealOps\automation\secrets\daangn-auth.json'

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  throw 'GitHub CLI(gh)가 필요합니다.'
}
if (-not (Test-Path $AuthPath)) {
  throw "당근 로그인 상태 파일을 찾지 못했습니다: $AuthPath"
}

gh auth status | Out-Null
$raw = [IO.File]::ReadAllText($AuthPath, [Text.Encoding]::UTF8)
$b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($raw))
gh secret set DAANGN_AUTH_STATE_B64 --repo $Repo --body $b64
if ($LASTEXITCODE -ne 0) { throw 'GitHub Secret 저장 실패' }

Write-Output 'DAANGN_AUTH_STATE_B64 secret saved.'
Write-Output '이제 PC가 꺼져 있어도 GitHub Actions 클라우드 러너가 자동 실행합니다.'
