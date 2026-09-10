"""从仓库维护源构建可复制的 Harness 文档与轻量工具包；不复制密钥或运行产物。"""
from pathlib import Path
import hashlib
import json
import re
import shutil

package = Path(__file__).resolve().parent
source = package.parent
entries = []

def include(relative):
    src = source / relative
    dst = package / relative
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    entries.append({'path': relative, 'sha256': hashlib.sha256(dst.read_bytes()).hexdigest()})

for folder in ['rules', 'skills/references', 'docs/工作流/正式生成']:
    for src in sorted((source / folder).rglob('*')):
        if src.is_file() and src.suffix in ['.md', '.json']:
            include(src.relative_to(source).as_posix())

for relative in [
    'docs/产品定义.md',
    'docs/产品需求.md',
    'docs/架构/结构库-变与不变.md',
    'assets/主题/中性编辑排版-001/asset.json',
    'schemas/composition-intent.schema.json',
]:
    include(relative)

# 轻量规则加载器、语义检查及组合解析的本地模块依赖闭包。
seen = set()
def module(relative):
    if relative in seen:
        return
    seen.add(relative)
    include(relative)
    src = source / relative
    for spec in re.findall(r'(?:from\s*|import\s*)[\'"]([^\'"]+)[\'"]', src.read_text(encoding='utf-8')):
        if spec.startswith('.'):
            dep = (src.parent / spec).resolve()
            module(dep.relative_to(source).as_posix())

for relative in ['src/tools/load-rules.mjs', 'src/tools/check-composition-intent.mjs', 'src/composition/resolve.mjs']:
    module(relative)

# 逐字节校验；不改正文、命令、链接、编码或换行。
for entry in entries:
    original = source / entry['path']
    copied = package / entry['path']
    assert original.read_bytes() == copied.read_bytes(), entry['path']
    entry['source_sha256'] = hashlib.sha256(original.read_bytes()).hexdigest()
    entry['sha256'] = hashlib.sha256(copied.read_bytes()).hexdigest()

(package / '内容包清单.json').write_text(json.dumps({
    'format': 1,
    'policy': '镜像文件由本脚本从仓库维护源同步；远端执行只读取包内文件，不访问维护源。共享修改回写维护源后重建，禁止手工维护两份。',
    'files': entries,
}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'已同步 {len(entries)} 个正文、配置和工具文件')
