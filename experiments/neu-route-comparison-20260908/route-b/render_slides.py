"""Re-render the final Route B PPTX with the local Presentations Skill."""
from pathlib import Path
import subprocess
import sys
import os

SKILL_RENDERER = Path(r"C:\Users\ilove\.codex\plugins\cache\openai-primary-runtime\presentations\26.826.12353\skills\presentations\container_tools\render_slides.py")
HERE = Path(__file__).resolve().parent

def main():
    pptx = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else HERE / "deck.pptx"
    output_dir = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else HERE / "rendered-final"
    output_dir.mkdir(parents=True, exist_ok=True)
    os.environ.setdefault("RUNTIME_NODE", r"C:\Users\ilove\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe")
    os.environ.setdefault("RUNTIME_NODE_MODULES", r"C:\Users\ilove\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules")
    os.environ.setdefault("RUNTIME_BIN_DIR", r"C:\Users\ilove\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\override")
    cmd = [sys.executable, str(SKILL_RENDERER), str(pptx), "--output_dir", str(output_dir)]
    subprocess.run(cmd, check=True)
    print(output_dir)

if __name__ == "__main__":
    main()
