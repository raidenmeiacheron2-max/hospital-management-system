# OCR all 9 reference images using Windows.Media.Ocr (memory-stream approach).
param(
    [string]$OutDir = 'F:\Project-Astra\tools\ocr'
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
    try {
        $netTask.Wait(-1) | Out-Null
    } catch {
        Write-Output ("AWAIT_ERR: " + $_.Exception.Message)
        if ($_.Exception.InnerException) {
            Write-Output ("INNER: " + $_.Exception.InnerException.Message + " | " + $_.Exception.InnerException.GetType().FullName)
        }
        return $null
    }
    return $netTask.Result
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
if ($null -eq $engine) {
    Write-Output 'NO_OCR_ENGINE'
    exit 1
}
Write-Output ("ENGINE_LANG=" + $engine.RecognizerLanguage.LanguageTag)

$images = Get-ChildItem 'F:\Project-Astra' -Filter '*.jpg' | Sort-Object Name
foreach ($img in $images) {
    $bytes = [System.IO.File]::ReadAllBytes($img.FullName)
    $stream = [Windows.Storage.Streams.InMemoryRandomAccessStream]::new()
    $writer = [Windows.Storage.Streams.DataWriter]::new($stream)
    $writer.WriteBytes($bytes)
    $null = Await ($writer.StoreAsync()) ([uint32])
    $stream.Seek(0)

    $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    if ($null -eq $decoder) { Write-Output ("DECODER_FAIL " + $img.Name); continue }
    $bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    if ($null -eq $bitmap) { Write-Output ("BITMAP_FAIL " + $img.Name); continue }

    $result = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])

    $sb = New-Object System.Text.StringBuilder
    [void]$sb.AppendLine("FILE: " + $img.Name)
    [void]$sb.AppendLine("SIZE: " + $decoder.PixelWidth + "x" + $decoder.PixelHeight)
    [void]$sb.AppendLine("---- LINES ----")
    if ($null -ne $result) {
        foreach ($line in $result.Lines) {
            $x = [math]::Round($line.Words[0].BoundingRect.X)
            $y = [math]::Round($line.Words[0].BoundingRect.Y)
            [void]$sb.AppendLine(("{0,5},{1,5} {2}" -f $x, $y, $line.Text))
        }
    }
    $outFile = Join-Path $OutDir ("img" + $img.Name.Substring($img.Name.IndexOf('_') + 1, 1) + ".txt")
    [System.IO.File]::WriteAllText($outFile, $sb.ToString(), [System.Text.Encoding]::UTF8)
    Write-Output ("OK " + $img.Name + " -> " + $outFile + " bytes=" + $sb.Length)
    $writer.Dispose()
    $stream.Dispose()
}
Write-Output 'DONE'
