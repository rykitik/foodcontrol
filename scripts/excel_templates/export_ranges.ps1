param(
    [Parameter(Mandatory = $true)]
    [string]$WorkbookPath,

    [Parameter(Mandatory = $true)]
    [string]$ManifestPath
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$manifest = Get-Content -Raw -Encoding UTF8 $ManifestPath | ConvertFrom-Json
$excel = $null
$workbook = $null

try {
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $true
    $excel.DisplayAlerts = $false
    $excel.ScreenUpdating = $true

    $workbook = $excel.Workbooks.Open($WorkbookPath)

    foreach ($entry in $manifest) {
        $worksheet = $null
        $range = $null
        $image = $null

        try {
            $worksheet = $workbook.Worksheets.Item($entry.sheet_title)
            $worksheet.Activate() | Out-Null
            $excel.ActiveWindow.Zoom = 120

            $range = $worksheet.Range($entry.visible_range)
            $range.Select() | Out-Null
            Start-Sleep -Milliseconds 400

            $range.CopyPicture(1, 2)
            Start-Sleep -Milliseconds 800

            if (-not [System.Windows.Forms.Clipboard]::ContainsImage()) {
                throw "Clipboard does not contain an image for range $($entry.visible_range)"
            }

            $image = [System.Windows.Forms.Clipboard]::GetImage()
            $outputDir = Split-Path -Parent $entry.output_path
            if (-not (Test-Path $outputDir)) {
                New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
            }

            $image.Save($entry.output_path, [System.Drawing.Imaging.ImageFormat]::Png)
            [System.Windows.Forms.Clipboard]::Clear()
        }
        finally {
            if ($image) {
                $image.Dispose()
            }
            if ($range) {
                [System.Runtime.InteropServices.Marshal]::ReleaseComObject($range) | Out-Null
            }
            if ($worksheet) {
                [System.Runtime.InteropServices.Marshal]::ReleaseComObject($worksheet) | Out-Null
            }
        }
    }
}
finally {
    if ($workbook) {
        $workbook.Close($false)
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($workbook) | Out-Null
    }
    if ($excel) {
        $excel.Quit()
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
    }
}
