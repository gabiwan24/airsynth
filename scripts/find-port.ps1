# Prints the first port >= $Start without a listening TCP socket. Exit 1 if none found.
param([int]$Start = 5173, [int]$Range = 200)
for ($p = $Start; $p -lt ($Start + $Range); $p++) {
    $busy = Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction SilentlyContinue
    if (-not $busy) { Write-Output $p; exit 0 }
}
exit 1
