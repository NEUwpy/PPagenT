export const PRODUCTION_DIRECTOR_METHODS = Object.freeze([
  "contentDirector",
  "visualDirector",
]);

export const DEVELOPMENT_REVIEW_METHODS = Object.freeze([
  "contentReview",
  "visualReview",
]);

export class DirectorProviderError extends Error {
  constructor(message) {
    super(message);
    this.name = "DirectorProviderError";
    this.code = "DIRECTOR_PROVIDER_UNAVAILABLE";
  }
}

export function assertDirectorProvider(provider, options = {}) {
  if (!provider || typeof provider !== "object") {
    throw new DirectorProviderError("缺少 DirectorProvider；工作流禁止回退到人工中间 JSON");
  }
  const required = options.requireReview
    ? [...PRODUCTION_DIRECTOR_METHODS, ...DEVELOPMENT_REVIEW_METHODS]
    : PRODUCTION_DIRECTOR_METHODS;
  const missing = required.filter((name) => typeof provider[name] !== "function");
  if (missing.length) {
    throw new DirectorProviderError(`DirectorProvider 缺少必要调用：${missing.join(", ")}`);
  }
  return provider;
}

export function defineDirectorProvider(provider, options = {}) {
  assertDirectorProvider(provider, options);
  const defined = {
    contentDirector: provider.contentDirector.bind(provider),
    visualDirector: provider.visualDirector.bind(provider),
  };
  for (const name of DEVELOPMENT_REVIEW_METHODS) {
    if (typeof provider[name] === "function") defined[name] = provider[name].bind(provider);
  }
  if (typeof provider.refineContent === "function") {
    defined.refineContent = provider.refineContent.bind(provider);
  }
  return Object.freeze(defined);
}
