import {original,layoutOnly} from '../gray-rules-20260916/prompts.mjs';
export {original};
function replaceOnce(text,from,to){if(!text.includes(from))throw new Error('Contract drift');return text.replace(from,to);}
const content=replaceOnce(original.content,
 '先明确页面职责，按内容归属形成groups，再把各分支的条目放进blocks，用label与text区分要点和展开。先形成可阅读的实文提纲，再选择局部表达；',
 '先把原稿组织成完整的阅读单元，再按归属与关系形成groups，最后判断哪些组共同成页。一个block可以只含text：用完整短句说明对象及其事实、行动或状态，不需要为填字段把句子拆成标签和残句。只有存在有用的概括与补充说明时才用label与text：label让读者识别要点，text提供尚未说出的依据、细节或条件；没有必要展开就省略label，把完整要点写在text中。状态、时间等是否独立成类取决于上下文是否需要按该维度检索或比较，而非词语本身；同一对象的关联事实可以合写，但不同分支不能丢失归属。以阅读收益决定单元边界，不能以语法成分或来源段落决定块数。先形成可阅读的实文提纲，再选择局部表达；');
const expression=replaceOnce(original.expression,
 '先检查组标题、条目要点、必要说明是否各有职责且归属清楚，再决定哪一部分用结构表达。',
 '先检查每个block是否是完整阅读单元，再决定表达。若label与text只是把一句话的对象、谓语或时间拆开，应合成完整text并省略label；若有真实分类、状态比较或检索需求，则可保留相应标签。只有text提供要点之外的必要说明时才保留两层，复述要点的说明应合并。组标题统领其下内容，不需要每个事实再套一个小标题。允许在所绑定来源范围内实际重组blocks，不只是保留原分块换媒介；需要改变分页或页主题才使用已有needsReplan返回具体问题。完成阅读单元检查后再决定哪一部分用结构表达。');
export const profiles={A:layoutOnly,B:{...layoutOnly,content,expression}};
