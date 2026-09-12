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

# 登记"已知外链"：包内的 .md 会带着源仓库写法的相对链接一起被镜像过来，其中指向
# experiments/、assets/ 这类没有进包的目标会变成死链。改链接就等于改正文，和上面
# "逐字节相同"的约定冲突，而这个包是给远端执行用的、不是导航用的，所以这里不修改，
# 只把它们逐条登记出来：数量一旦变化就能从清单里看出来，不会悄悄变多。
LINK = re.compile(r'\]\(([^)\s]+)\)')
boundary_links = []
for entry in entries:
    if not entry['path'].endswith('.md'):
        continue
    copied = package / entry['path']
    for link in LINK.findall(copied.read_text(encoding='utf-8')):
        if link.startswith(('http://', 'https://', 'mailto:', '#')):
            continue
        anchorless = link.split('#')[0]
        if not anchorless:
            continue
        resolved = (copied.parent / anchorless).resolve()
        inside = resolved == package or package in resolved.parents
        if inside and resolved.exists():
            continue
        # 链接在包内断了，不代表它在维护源里也断了——镜像只搬运了正文，
        # 没有搬运 assets/、experiments/ 这些证据。按维护源的位置再解析一次，
        # 才能区分"包外有、包内没有"和"链接本身早就过期"。
        in_source = (source / entry['path']).parent.joinpath(anchorless).resolve().exists()
        boundary_links.append({'source': entry['path'], 'link': link, 'inRepository': in_source})

(package / '内容包清单.json').write_text(json.dumps({
    'format': 1,
    'policy': '镜像文件由本脚本从仓库维护源同步；远端执行只读取包内文件，不访问维护源。共享修改回写维护源后重建，禁止手工维护两份。',
    'boundaryLinksNote': '这些是镜像正文里指向包外的相对链接（多为 assets/、experiments/ 证据）。链接与正文逐字节保持源文，不做改写；inRepository 为 true 表示目标在维护源里存在、只是没进包，false 表示源里也已失效。',
    'boundaryLinks': boundary_links,
    'files': entries,
}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
stale = sum(1 for item in boundary_links if not item['inRepository'])
print(f'已同步 {len(entries)} 个正文、配置和工具文件')
print(f'登记已知外链 {len(boundary_links)} 条（其中 {stale} 条在维护源里也已失效）')
