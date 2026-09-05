Add-Type -AssemblyName System.IO.Compression.FileSystem
$pptx = 'C:\PPagenT\experiments\university-skin-pilot\round-04\deck.pptx'
$zip = [System.IO.Compression.ZipFile]::OpenRead($pptx)
$ns = New-Object System.Xml.XmlNamespaceManager((New-Object System.Xml.NameTable))
$ns.AddNamespace('p','http://schemas.openxmlformats.org/presentationml/2006/main')
$ns.AddNamespace('a','http://schemas.openxmlformats.org/drawingml/2006/main')
$bad = @()
foreach ($entry in $zip.Entries | Where-Object { $_.FullName -match '^ppt/slides/slide\d+\.xml$' }) {
  $reader = New-Object System.IO.StreamReader($entry.Open())
  $xml = New-Object System.Xml.XmlDocument
  $xml.LoadXml($reader.ReadToEnd())
  $reader.Dispose()
  foreach ($sp in $xml.SelectNodes('//p:sp[p:nvSpPr/p:nvPr/p:ph]', $ns)) {
    $text = (($sp.SelectNodes('.//a:t', $ns) | ForEach-Object { $_.InnerText }) -join '')
    if ([string]::IsNullOrWhiteSpace($text)) { $bad += "$($entry.FullName): empty placeholder" }
  }
}
$zip.Dispose()
if ($bad.Count -eq 0) { 'EMPTY_PLACEHOLDERS=0' } else { $bad }
