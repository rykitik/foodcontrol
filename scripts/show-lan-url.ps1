param(
    [int]$FrontendPort = 5173,
    [int]$BackendPort = 5000
)

$addresses = [System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces() |
    Where-Object {
        $_.OperationalStatus -eq [System.Net.NetworkInformation.OperationalStatus]::Up -and
        $_.NetworkInterfaceType -ne [System.Net.NetworkInformation.NetworkInterfaceType]::Loopback
    } |
    ForEach-Object {
        $interfaceName = $_.Name
        $_.GetIPProperties().UnicastAddresses |
            Where-Object {
                $_.Address.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork -and
                $_.Address.ToString() -notlike '127.*' -and
                $_.Address.ToString() -notlike '169.254.*'
            } |
            ForEach-Object {
                [pscustomobject]@{
                    Interface = $interfaceName
                    IPAddress = $_.Address.ToString()
                }
            }
    } |
    Sort-Object IPAddress -Unique

if (-not $addresses) {
    Write-Host 'No active LAN IPv4 address found.'
    exit 1
}

Write-Host 'Share one of these frontend URLs inside the local college network:'
foreach ($address in $addresses) {
    Write-Host ("[{0}] http://{1}:{2}" -f $address.Interface, $address.IPAddress, $FrontendPort)
}

Write-Host ''
Write-Host 'Direct backend URL (usually only needed for diagnostics on the same machine):'
foreach ($address in $addresses) {
    Write-Host ("[{0}] http://{1}:{2}" -f $address.Interface, $address.IPAddress, $BackendPort)
}

Write-Host ''
Write-Host ("If another PC cannot open the frontend URL, allow inbound TCP {0} in Windows Firewall." -f $FrontendPort)
