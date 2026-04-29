param(
    [string]$FrontendUrl = 'http://127.0.0.1:5173',
    [string]$OutputDir = '',
    [string]$Username = 'accountant',
    [string]$Password = 'password123',
    [switch]$SkipBrowserInstall
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$artifactRoot = if ($OutputDir) {
    [System.IO.Path]::GetFullPath($OutputDir)
} else {
    [System.IO.Path]::GetFullPath((Join-Path $repoRoot 'output/playwright/accountant-ui-smoke'))
}
$manifestPath = Join-Path $artifactRoot 'manifest.json'
$cmd = (Get-Command cmd.exe -ErrorAction Stop).Source
$sessionId = 'accountant-ui-smoke-' + [DateTimeOffset]::UtcNow.ToString('yyyyMMddHHmmss')
$playwrightScratchDir = Join-Path $repoRoot '.playwright-cli'

function Invoke-PlaywrightCli {
    param(
        [switch]$Raw,
        [Parameter(ValueFromRemainingArguments = $true)][string[]]$CliArguments
    )

    $allArguments = @('npx', '--yes', '@playwright/cli')
    if ($Raw) {
        $allArguments += '--raw'
    }
    foreach ($argument in $CliArguments) {
        $allArguments += [string]$argument
    }

    $formattedArguments = foreach ($argument in $allArguments) {
        if ($argument -match '\s') {
            '"' + $argument.Replace('"', '\"') + '"'
            continue
        }

        $argument
    }

    $commandText = [string]::Join(' ', $formattedArguments)
    & $cmd '/c' $commandText
    if ($LASTEXITCODE -ne 0) {
        throw "Playwright CLI failed: $($CliArguments -join ' ')"
    }
}

function Assert-FrontendAvailable {
    try {
        $null = Invoke-WebRequest -Uri $FrontendUrl -UseBasicParsing -TimeoutSec 5
    } catch {
        throw "Frontend is unavailable at $FrontendUrl"
    }
}

function Read-ToolbarText {
    $rawOutput = Invoke-PlaywrightCli -Raw ('-s=' + $sessionId) 'eval' "() => document.querySelector('[data-testid=accountant-preview-toolbar]')?.textContent ?? ''"
    return (($rawOutput | Out-String).Trim()) -replace '^"|"$', ''
}

function Invoke-RawEval {
    param(
        [Parameter(Mandatory = $true)][string]$Expression
    )

    $rawOutput = Invoke-PlaywrightCli -Raw ('-s=' + $sessionId) 'eval' $Expression
    return (($rawOutput | Out-String).Trim()) -replace '^"|"$', ''
}

function Copy-LatestScreenshot {
    param(
        [Parameter(Mandatory = $true)][string]$DestinationPath
    )

    $latestScreenshot = Get-ChildItem -Path $playwrightScratchDir -Filter 'page-*.png' -File |
        Sort-Object LastWriteTimeUtc -Descending |
        Select-Object -First 1

    if ($null -eq $latestScreenshot) {
        throw 'Playwright screenshot was not created'
    }

    Copy-Item -LiteralPath $latestScreenshot.FullName -Destination $DestinationPath -Force
}

function Capture-Screenshot {
    param(
        [Parameter(Mandatory = $true)][string]$DestinationPath
    )

    Invoke-PlaywrightCli ('-s=' + $sessionId) 'screenshot'
    Copy-LatestScreenshot -DestinationPath $DestinationPath
}

function Parse-ScaleLabel {
    param(
        [Parameter(Mandatory = $true)][string]$ToolbarText
    )

    $matches = [regex]::Matches($ToolbarText, '(\d+%)')
    if ($matches.Count -eq 0) {
        throw "Scale label was not found in toolbar text: $ToolbarText"
    }

    return $matches[$matches.Count - 1].Groups[1].Value
}

Assert-FrontendAvailable
New-Item -ItemType Directory -Force -Path $artifactRoot | Out-Null

if (Test-Path $playwrightScratchDir) {
    Remove-Item -LiteralPath $playwrightScratchDir -Recurse -Force
}

if (-not $SkipBrowserInstall) {
    Invoke-PlaywrightCli 'install-browser' 'chromium'
}

$overviewPng = Join-Path $artifactRoot 'accountant-overview.png'
$keyboardZoomPng = Join-Path $artifactRoot 'accountant-keyboard-zoom.png'
$wheelZoomPng = Join-Path $artifactRoot 'accountant-wheel-zoom.png'

try {
    Invoke-PlaywrightCli ('-s=' + $sessionId) 'open' "$FrontendUrl/login?redirect=/accountant" '--headed'
    Invoke-PlaywrightCli ('-s=' + $sessionId) 'fill' '[data-testid=login-username]' $Username
    Invoke-PlaywrightCli ('-s=' + $sessionId) 'fill' '[data-testid=login-password]' $Password
    Invoke-PlaywrightCli ('-s=' + $sessionId) 'click' '[data-testid=login-submit]'
    Invoke-PlaywrightCli ('-s=' + $sessionId) 'snapshot'

    $initialToolbar = Read-ToolbarText
    $initialScale = Parse-ScaleLabel -ToolbarText $initialToolbar
    Capture-Screenshot -DestinationPath $overviewPng

    Invoke-PlaywrightCli ('-s=' + $sessionId) 'click' '[data-testid=accountant-preview-fit-width]'
    Invoke-PlaywrightCli ('-s=' + $sessionId) 'click' '[data-testid=accountant-preview-viewport]'
    Invoke-PlaywrightCli ('-s=' + $sessionId) 'press' 'Control+='
    $keyboardToolbar = Read-ToolbarText
    $keyboardScale = Parse-ScaleLabel -ToolbarText $keyboardToolbar
    Capture-Screenshot -DestinationPath $keyboardZoomPng

    Invoke-PlaywrightCli ('-s=' + $sessionId) 'click' '[data-testid=accountant-preview-fit-width]'
    $wheelToolbar = Invoke-RawEval "() => { const viewport = document.querySelector('[data-testid=accountant-preview-viewport]'); const rect = viewport?.getBoundingClientRect(); viewport?.dispatchEvent(new WheelEvent('wheel', { deltaY: -120, ctrlKey: true, bubbles: true, cancelable: true, clientX: (rect?.left ?? 0) + 80, clientY: (rect?.top ?? 0) + 80 })); return document.querySelector('[data-testid=accountant-preview-toolbar]')?.textContent ?? ''; }"
    $wheelScale = Parse-ScaleLabel -ToolbarText $wheelToolbar
    Capture-Screenshot -DestinationPath $wheelZoomPng

    if ($keyboardScale -eq $initialScale) {
        throw 'Keyboard zoom did not change preview scale'
    }
    if ($wheelScale -eq $initialScale) {
        throw 'Ctrl+wheel zoom did not change preview scale'
    }

    $manifest = [pscustomobject]@{
        generatedAt = [DateTimeOffset]::UtcNow.ToString('o')
        frontendUrl = $FrontendUrl
        sessionId = $sessionId
        screenshots = [pscustomobject]@{
            overview = [System.IO.Path]::GetFileName($overviewPng)
            keyboardZoom = [System.IO.Path]::GetFileName($keyboardZoomPng)
            wheelZoom = [System.IO.Path]::GetFileName($wheelZoomPng)
        }
        zoom = [pscustomobject]@{
            initialScale = $initialScale
            keyboardScale = $keyboardScale
            wheelScale = $wheelScale
            initialToolbar = $initialToolbar
            keyboardToolbar = $keyboardToolbar
            wheelToolbar = $wheelToolbar
        }
    }
    $manifest | ConvertTo-Json -Depth 6 | Set-Content -Path $manifestPath -Encoding UTF8
} finally {
    try {
        Invoke-PlaywrightCli ('-s=' + $sessionId) 'close'
    } catch {
    }
}

[pscustomobject]@{
    manifest = $manifestPath
    overview = $overviewPng
    keyboardZoom = $keyboardZoomPng
    wheelZoom = $wheelZoomPng
}
