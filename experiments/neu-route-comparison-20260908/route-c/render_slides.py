"""Re-render the final route C PPTX with the bundled presentation renderer."""
from __future__ import annotations

import os
import subprocess
import sys


SKILL_RENDERER = r"C:\Users\ilove\.codex\plugins\cache\openai-primary-runtime\presentations\26.826.12353\skills\presentations\container_tools\render_slides.py"


def main() -> int:
    env = os.environ.copy()
    env.setdefault("RUNTIME_NODE", r"C:\Users\ilove\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe")
    env.setdefault("RUNTIME_NODE_MODULES", r"C:\Users\ilove\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules")
    env.setdefault("RUNTIME_BIN_DIR", r"C:\Users\ilove\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\override")
    completed = subprocess.run([sys.executable, SKILL_RENDERER, *sys.argv[1:]], env=env)
    return completed.returncode


if __name__ == "__main__":
    raise SystemExit(main())
