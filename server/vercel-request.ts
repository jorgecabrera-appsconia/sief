export function restoreVercelApiUrl(requestUrl: string): string {
  const url = new URL(requestUrl, "http://localhost");
  const parameterName = url.searchParams.has("path")
    ? "path"
    : url.searchParams.has("__sief_path")
      ? "__sief_path"
      : undefined;

  if (!parameterName) return requestUrl;

  const apiPath = url.searchParams
    .getAll(parameterName)
    .join("/")
    .replace(/^\/+/, "");
  url.searchParams.delete(parameterName);
  const query = url.searchParams.toString();

  return `/api/${apiPath}${query ? `?${query}` : ""}`;
}
