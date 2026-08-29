import fs from "node:fs/promises";
import path from "node:path";
import mammoth from "mammoth";

const SUPPORTED_EXTENSIONS = Object.freeze([".docx", ".md", ".markdown", ".txt"]);

function decodeEntities(value) {
  const entities = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return String(value).replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_match, entity) => {
    if (entity[0] === "#") {
      const hexadecimal = entity[1]?.toLowerCase() === "x";
      return String.fromCodePoint(Number.parseInt(entity.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10));
    }
    return entities[entity.toLowerCase()] ?? `&${entity};`;
  });
}

function inlineText(html) {
  return decodeEntities(String(html)
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/[ \t]+/g, " "))
    .trim();
}

function tablesToMarkdown(html) {
  return String(html).replace(/<table\b[^>]*>([\s\S]*?)<\/table>/gi, (_table, body) => {
    const rows = [...body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) => (
      [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => inlineText(cell[1]).replaceAll("|", "\\|"))
    )).filter((row) => row.length);
    if (!rows.length) return "";
    const width = Math.max(...rows.map((row) => row.length));
    const normalized = rows.map((row) => [...row, ...Array(width - row.length).fill("")]);
    return `\n${normalized.map((row, index) => `${index === 1 ? `| ${Array(width).fill("---").join(" | ")} |\n` : ""}| ${row.join(" | ")} |`).join("\n")}\n`;
  });
}

export function htmlToMarkdown(html) {
  let output = tablesToMarkdown(html);
  output = output.replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_match, level, body) => `\n${"#".repeat(Number(level))} ${inlineText(body)}\n`);
  output = output.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_match, body) => `\n- ${inlineText(body)}\n`);
  output = output.replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, (_match, body) => `\n${inlineText(body)}\n`);
  output = inlineText(output.replace(/<\/?(?:ul|ol|div|section)\b[^>]*>/gi, "\n"));
  return output.replace(/\n{3,}/g, "\n\n").trim();
}

export async function normalizeManuscript({ inputPath, originalName }) {
  const extension = path.extname(originalName || inputPath).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.includes(extension)) {
    if (extension === ".doc") throw new Error("旧版 .doc 是二进制格式，当前工作台不静默转换；请另存为 .docx 后上传。");
    throw new Error(`不支持的稿件格式：${extension || "无扩展名"}`);
  }
  if (extension !== ".docx") {
    return { rawMarkdown: await fs.readFile(inputPath, "utf8"), format: extension.slice(1), messages: [] };
  }
  const result = await mammoth.convertToHtml(
    { buffer: await fs.readFile(inputPath) },
    { styleMap: ["p[style-name='Title'] => h1:fresh", "p[style-name='Heading 1'] => h1:fresh", "p[style-name='Heading 2'] => h2:fresh", "p[style-name='Heading 3'] => h3:fresh"] },
  );
  const rawMarkdown = htmlToMarkdown(result.value);
  if (!rawMarkdown.trim()) throw new Error("DOCX 未解析出可用正文。");
  return {
    rawMarkdown,
    format: "docx",
    messages: result.messages.map((message) => ({ type: message.type, message: message.message })),
  };
}

export const supportedManuscriptExtensions = SUPPORTED_EXTENSIONS;
