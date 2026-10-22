# OCR screenshots in a directory (PNG/JPG) using Windows.Media.Ocr.
param(
    [string]$InDir = 'F:\Project-Astra\tests\e2e\shots',
    [string]$OutDir = 'F:\Project-Astra\tests\e2e\ocr'
)

$ErrorActionPreference = 'Continue'

[Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.Streams.InMemoryRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.Streams.DataWriter, Windows.Storage.Streams, ContentType = WindowsRuntime] | Out-Null

Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
        $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
    })[0]

function Await($WinRtTask, $ResultType) {
    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
    $netTask = $asTask.Invoke($null, @($WinRtTask))
    $netTask.Wait(-1) | Out-Null
    $netTask.Result
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
if ($null -eq $engine) { Write-Output 'NO_OCR_ENGINE'; exit 1 }

Get-ChildItem $InDir -Include *.png, *.jpg -Recurse | Sort-Object Name | ForEach-Object {
    $bytes = [System.IO.File]::ReadAllBytes($_.FullName)
    $stream = [Windows.Storage.Streams.InMemoryRandomAccessStream]::new()
    $writer = [Windows.Storage.Streams.DataWriter]::new($stream)
    $writer.WriteBytes($bytes)
    $null = Await ($writer.StoreAsync()) ([uint32])
    $stream.Seek(0)
    $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    $result = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
    $sb = New-Object System.Text.StringBuilder
    foreach ($line in $result.Lines) {
        [void]$sb.AppendLine($line.Text)
    }
    $outFile = Join-Path $OutDir ($_.BaseName + '.txt')
    [System.IO.File]::WriteAllText($outFile, $sb.ToString(), [System.Text.Encoding]::UTF8)
    Write-Output ("OK " + $_.Name + " -> " + $outFile)
    $writer.Dispose()
    $stream.Dispose()
}
Write-Output 'DONE'
