$filePath = 'c:\Rider App\src\components\RiderDetailsModal.tsx'
$lines = [System.IO.File]::ReadAllLines($filePath)
$trimmed = $lines[0..610]
[System.IO.File]::WriteAllLines($filePath, $trimmed, [System.Text.UTF8Encoding]::new($false))
Write-Host "Done: file trimmed to $($trimmed.Length) lines"
