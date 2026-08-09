export const DIRECTOR_METHODS = Object.freeze([
  "contentDirector",
  "contentReview",
  "visualDirector",
  "visualReview",
]);

export class DirectorProviderError extends Error {
  constructor(message) {
    super(message);
    this.name = "DirectorProviderError";
    this.code = "DIRECTOR_PROVIDER_UNAVAILABLE";
  }
}

export function assertDirectorProvider(provider) {
  if (!provider || typeof provider !== "object") {
    throw new DirectorProviderError("缺少 DirectorProvider；工作流禁止回退到人工中间 JSON");
  }
  const missing = DIRECTOR_METHODS.filter((name) => typeof provider[name] !== "function");
  if (missing.length) {
    throw new DirectorProviderError(`DirectorProvider 缺少必要调用：${missing.join(", ")}`);
  }
  return provider;
}

export function defineDirectorProvider(provider) {
  assertDirectorProvider(provider);
  return Object.freeze({
    contentDirector: provider.contentDirector.bind(provider),
    contentReview: provider.contentReview.bind(provider),
    visualDirector: provider.visualDirector.bind(provider),
    visualReview: provider.visualReview.bind(provider),
  });
}
