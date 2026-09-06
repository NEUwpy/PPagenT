"""Read-only native PPTX inventory and visible-copy extraction for review."""
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

NS = {"p": "http://schemas.openxmlformats.org/presentationml/2006/main",
      "a": "http://schemas.openxmlformats.org/drawingml/2006/main"}
with zipfile.ZipFile(sys.argv[1]) as deck:
    slides = sorted((n for n in deck.namelist() if re.fullmatch(r"ppt/slides/slide\d+\.xml", n)),
                    key=lambda n: int(re.search(r"slide(\d+)", n).group(1)))
    rows = []
    for name in slides:
        root = ET.fromstring(deck.read(name))
        text = ["".join(p.itertext()) for p in root.findall(".//a:t", NS)]
        rows.append({"page": len(rows) + 1, "entry": name,
                     "shapes": len(root.findall(".//p:sp", NS)),
                     "connectors": len(root.findall(".//p:cxnSp", NS)),
                     "pictures": len(root.findall(".//p:pic", NS)),
                     "graphicFrames": len(root.findall(".//p:graphicFrame", NS)),
                     "text": text})
print(json.dumps(rows, ensure_ascii=False))
