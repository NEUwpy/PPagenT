import path from "node:path";
import { createOpenAIDirectorProvider } from "./openai-director-provider.mjs";

export default await createOpenAIDirectorProvider({
  root: path.resolve(process.cwd()),
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.PPAGENT_OPENAI_MODEL,
  endpoint: process.env.PPAGENT_OPENAI_ENDPOINT || undefined,
});
