"""Restore source theme bytes after artifact-tool export, before final reimport."""
from pathlib import Path
import sys, zipfile, os
root=Path(__file__).resolve().parents[2]
target=Path(sys.argv[1]).resolve()
with zipfile.ZipFile(root/'assets/主题/东北大学-001/runtime-template.pptx') as z:
    themes={n:z.read(n) for n in z.namelist() if n.startswith('ppt/theme/') and n.endswith('.xml')}
temporary=target.with_suffix('.theme-restored.pptx')
with zipfile.ZipFile(target) as src, zipfile.ZipFile(temporary,'w',zipfile.ZIP_DEFLATED) as dst:
    for item in src.infolist():
        dst.writestr(item,themes.get(item.filename,src.read(item.filename)))
os.replace(temporary,target)
