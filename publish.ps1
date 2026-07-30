<#
  Prepare this folder for GitHub Pages, then print the steps you need.

  Usage (PowerShell, from inside this folder):
      .\publish.ps1 your-github-username

  If PowerShell refuses to run it, either use the bash version in Git Bash
  (./publish.sh your-github-username) or run:
      powershell -ExecutionPolicy Bypass -File .\publish.ps1 your-github-username
#>
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$GitHubUser
)

$ErrorActionPreference = 'Stop'
$repo = 'aetheris'

# Bake the real URLs into the social-preview metadata.
foreach ($f in @('index.html', 'README.md')) {
  $text = Get-Content -Raw -Encoding UTF8 $f
  if ($text -match 'REPLACE_USER') {
    $text = $text -replace 'REPLACE_USER', $GitHubUser
    # write without a BOM, so the HTML stays byte-clean
    [IO.File]::WriteAllText((Resolve-Path $f), $text, (New-Object Text.UTF8Encoding $false))
    Write-Host "updated $f"
  }
}

if (-not (Test-Path .git)) {
  git init -q
  # works on every git version, including before `init -b` existed
  git symbolic-ref HEAD refs/heads/main
}
git add -A
git commit -q -m "Aetheris: a procedural world held in climatic balance"
if ($LASTEXITCODE -ne 0) { Write-Host "nothing new to commit" }

Write-Host @"

Committed. Three steps left:

  1. Create an empty public repo named "$repo" at
     https://github.com/new
     (no README, no .gitignore, no license - this folder already has them)

  2. Push it:

     git remote add origin https://github.com/$GitHubUser/$repo.git
     git push -u origin main

  3. Turn on Pages:
     Settings -> Pages -> Source: "Deploy from a branch"
                          Branch: main, folder: / (root) -> Save

Your site will be live in a minute or two at:

     https://$GitHubUser.github.io/$repo/

"@
