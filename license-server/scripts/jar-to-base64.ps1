param(
    [Parameter(Mandatory = $true)]
    [string] $JarPath
)

$resolved = Resolve-Path -LiteralPath $JarPath
$base64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($resolved))
$base64 | Set-Clipboard
Write-Host "CLIENT_JAR_BASE64 copied to clipboard."
Write-Host "Length: $($base64.Length)"
