param(
    [string]$ApiBaseUrl = 'http://127.0.0.1:5000',
    [string]$OutputDir = '',
    [string]$Username = 'accountant',
    [string]$Password = 'password123',
    [int]$Port = 8787,
    [switch]$SkipBrowserInstall
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$artifactRoot = if ($OutputDir) {
    [System.IO.Path]::GetFullPath($OutputDir)
} else {
    [System.IO.Path]::GetFullPath((Join-Path $repoRoot 'output/playwright/accountant-preview'))
}

$manifestPath = Join-Path $artifactRoot 'manifest.json'
$sessionId = 'accountant-preview-smoke-' + [DateTimeOffset]::UtcNow.ToString('yyyyMMddHHmmss')
$cmd = (Get-Command cmd.exe -ErrorAction Stop).Source

$cases = @(
    @{
        slug = 'accountant-ovz-breakfast'
        endpoint = '/api/reports/accounting-documents/meal-sheet/document'
        categoryCode = 'ovz'
        payload = @{
            month = 2
            year = 2025
            meal_type = 'breakfast'
        }
    },
    @{
        slug = 'accountant-orphan-lunch'
        endpoint = '/api/reports/accounting-documents/meal-sheet/document'
        categoryCode = 'orphan'
        payload = @{
            month = 2
            year = 2025
            meal_type = 'lunch'
        }
    },
    @{
        slug = 'accountant-low-income-cost-statement'
        endpoint = '/api/reports/accounting-documents/cost-statement/document'
        categoryCode = 'low_income'
        payload = @{
            month = 2
            year = 2025
        }
    }
)

$previewBaseStyles = @'
<style>
  .accounting-worksheet-page {
    display: block;
    width: 100%;
    overflow-x: auto;
  }

  .accounting-worksheet {
    display: block;
    width: var(--accounting-screen-width, auto);
    min-width: var(--accounting-screen-width, auto);
    color: #111111;
  }

  .accounting-worksheet-table {
    width: 100%;
    min-width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }

  .accounting-worksheet-table col {
    width: var(--accounting-screen-col-width) !important;
  }

  .accounting-worksheet-table td {
    padding: 0;
    box-sizing: border-box;
  }
</style>
'@

$previewShellStyles = @'
<style>
  :root {
    color-scheme: light;
    font-family: "Segoe UI", Arial, sans-serif;
  }

  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    padding: 28px;
    background:
      radial-gradient(circle at top, rgba(255, 255, 255, 0.92), transparent 48%),
      linear-gradient(180deg, #e2e8f0 0%, #f8fafc 55%, #f1f5f9 100%);
    color: #0f172a;
  }

  .preview-stage {
    display: grid;
    gap: 14px;
    max-width: 1800px;
    margin: 0 auto;
  }

  .preview-toolbar {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: center;
    padding: 14px 16px;
    border-radius: 20px;
    border: 1px solid rgba(148, 163, 184, 0.22);
    background: rgba(15, 23, 42, 0.04);
  }

  .preview-copy {
    display: grid;
    gap: 4px;
  }

  .preview-copy span {
    color: #475569;
    font-size: 14px;
  }

  .preview-copy strong {
    font-size: 16px;
  }

  .preview-badges {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .preview-badge {
    display: inline-flex;
    align-items: center;
    min-height: 30px;
    padding: 0 12px;
    border-radius: 999px;
    background: rgba(15, 23, 42, 0.08);
    color: #0f172a;
    font-size: 13px;
    font-weight: 700;
    white-space: nowrap;
  }

  .preview-frame-shell {
    padding: 14px;
    border-radius: 24px;
    border: 1px solid rgba(148, 163, 184, 0.2);
    background:
      linear-gradient(180deg, rgba(226, 232, 240, 0.48), rgba(248, 250, 252, 0.78)),
      radial-gradient(circle at top, rgba(255, 255, 255, 0.75), transparent 55%);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.65);
  }

  .preview-frame {
    border: 1px solid rgba(148, 163, 184, 0.18);
    border-radius: 18px;
    overflow: auto;
    background: #ffffff;
    box-shadow: 0 24px 48px rgba(148, 163, 184, 0.16);
  }

  .preview-document {
    min-width: max-content;
    padding: 20px;
  }
</style>
'@

function Assert-ApiAvailable {
    try {
        $null = Invoke-RestMethod -Method Get -Uri "$ApiBaseUrl/api/health"
    } catch {
        throw "Backend API is unavailable at $ApiBaseUrl. Start the stack first, for example: docker compose up -d backend frontend"
    }
}

function Invoke-ApiJson {
    param(
        [Parameter(Mandatory = $true)][ValidateSet('GET', 'POST')][string]$Method,
        [Parameter(Mandatory = $true)][string]$Path,
        [hashtable]$Headers,
        [object]$Body
    )

    $request = @{
        Method = $Method
        Uri = "$ApiBaseUrl$Path"
        ContentType = 'application/json'
    }

    if ($Headers) {
        $request.Headers = $Headers
    }

    if ($null -ne $Body) {
        $request.Body = ($Body | ConvertTo-Json -Depth 10)
    }

    return Invoke-RestMethod @request
}

function New-PreviewShellHtml {
    param(
        [Parameter(Mandatory = $true)][string]$DocumentTitle,
        [Parameter(Mandatory = $true)][string]$PreviewHtml,
        [Parameter(Mandatory = $true)][string]$GeneratedAt
    )

    return @"
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="icon" href="data:," />
  <title>$DocumentTitle</title>
  $previewBaseStyles
  $previewShellStyles
</head>
<body>
  <main class="preview-stage">
    <section class="preview-toolbar">
      <div class="preview-copy">
        <span>Document preview</span>
        <strong>$DocumentTitle</strong>
      </div>
      <div class="preview-badges">
        <span class="preview-badge">Browser smoke</span>
        <span class="preview-badge">$GeneratedAt</span>
      </div>
    </section>
    <section class="preview-frame-shell">
      <div class="preview-frame">
        <div class="preview-document">
          $PreviewHtml
        </div>
      </div>
    </section>
  </main>
</body>
</html>
"@
}

function Invoke-PlaywrightCli {
    param(
        [Parameter(ValueFromRemainingArguments = $true)][string[]]$CliArguments
    )

    $allArguments = @('npx', '--yes', '@playwright/cli')
    foreach ($argument in $CliArguments) {
        $allArguments += [string]$argument
    }

    $formattedArguments = foreach ($argument in $allArguments) {
        if ($argument -match '\s') {
            '"' + $argument + '"'
            continue
        }

        $argument
    }

    $commandText = [string]::Join(' ', $formattedArguments)
    if ($env:CODEX_DEBUG_PLAYWRIGHT) {
        Write-Host "PWCLI> $commandText"
    }
    & $cmd '/c' $commandText
    if ($LASTEXITCODE -ne 0) {
        throw "Playwright CLI failed: $($CliArguments -join ' ')"
    }
}

function Wait-ForHttpServer {
    param(
        [Parameter(Mandatory = $true)][string]$Url
    )

    for ($attempt = 0; $attempt -lt 60; $attempt += 1) {
        try {
            $null = Invoke-WebRequest -UseBasicParsing -Uri $Url
            return
        } catch {
            Start-Sleep -Milliseconds 500
        }
    }

    throw "Static server did not start at $Url"
}

Assert-ApiAvailable
New-Item -ItemType Directory -Force -Path $artifactRoot | Out-Null

$loginResponse = Invoke-ApiJson -Method POST -Path '/api/auth/login' -Body @{
    username = $Username
    password = $Password
}
$token = $loginResponse.data.token
if (-not $token) {
    throw 'Login succeeded without a JWT token'
}

$headers = @{
    Authorization = "Bearer $token"
}

$categoriesResponse = Invoke-ApiJson -Method GET -Path '/api/categories' -Headers $headers
$categoryIdsByCode = @{}
foreach ($category in $categoriesResponse.data) {
    $categoryIdsByCode[$category.code] = [int]$category.id
}

$generatedAt = [DateTimeOffset]::UtcNow.ToString('yyyy-MM-dd HH:mm:ss UTC')
$manifestCases = @()

foreach ($case in $cases) {
    $categoryId = $categoryIdsByCode[$case.categoryCode]
    if ($null -eq $categoryId) {
        throw "Category with code '$($case.categoryCode)' was not found"
    }

    $payload = @{}
    foreach ($key in $case.payload.Keys) {
        $payload[$key] = $case.payload[$key]
    }
    $payload.category_id = $categoryId

    $documentResponse = Invoke-ApiJson -Method POST -Path $case.endpoint -Headers $headers -Body $payload
    $document = $documentResponse.data

    $htmlFileName = "$($case.slug).html"
    $pngFileName = "$($case.slug).png"
    $htmlPath = Join-Path $artifactRoot $htmlFileName
    $wrappedHtml = New-PreviewShellHtml -DocumentTitle $document.title -PreviewHtml $document.html -GeneratedAt $generatedAt
    Set-Content -Path $htmlPath -Value $wrappedHtml -Encoding UTF8

    $manifestCases += [pscustomobject]@{
        slug = $case.slug
        title = $document.title
        htmlFile = $htmlFileName
        screenshotFile = $pngFileName
        url = "http://127.0.0.1:$Port/$htmlFileName"
        endpoint = $case.endpoint
        categoryCode = $case.categoryCode
    }
}

$manifest = [pscustomobject]@{
    generatedAt = [DateTimeOffset]::UtcNow.ToString('o')
    apiBaseUrl = $ApiBaseUrl
    artifactRoot = $artifactRoot
    cases = $manifestCases
}
$manifest | ConvertTo-Json -Depth 5 | Set-Content -Path $manifestPath -Encoding UTF8

if (-not $SkipBrowserInstall) {
    Invoke-PlaywrightCli 'install-browser' 'chromium'
}

$httpServerCommand = 'npx --yes http-server "' + $artifactRoot + '" -a 127.0.0.1 -p ' + $Port + ' -c-1'
$serverProcess = Start-Process -FilePath $cmd -ArgumentList @('/c', $httpServerCommand) -WorkingDirectory $repoRoot -PassThru -WindowStyle Hidden

try {
    Wait-ForHttpServer -Url "http://127.0.0.1:$Port/manifest.json"

    $firstCase = $true
    foreach ($case in $manifestCases) {
        if ($firstCase) {
            Invoke-PlaywrightCli ('-s=' + $sessionId) 'open' $case.url
            $firstCase = $false
        } else {
            Invoke-PlaywrightCli ('-s=' + $sessionId) 'goto' $case.url
        }

        Invoke-PlaywrightCli ('-s=' + $sessionId) 'resize' '1680' '2200'
        Invoke-PlaywrightCli ('-s=' + $sessionId) 'screenshot' '--filename' (Join-Path $artifactRoot $case.screenshotFile) '--full-page'
    }
} finally {
    try {
        Invoke-PlaywrightCli ('-s=' + $sessionId) 'close'
    } catch {
    }

    if ($serverProcess -and -not $serverProcess.HasExited) {
        Stop-Process -Id $serverProcess.Id -Force
    }
}

$manifestCases | Select-Object slug, htmlFile, screenshotFile
