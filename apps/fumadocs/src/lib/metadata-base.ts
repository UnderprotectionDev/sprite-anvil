export function getMetadataBase(docsUrl: string | undefined): URL {
  try {
    return new URL(docsUrl ?? "http://localhost:4000");
  } catch {
    return new URL("http://localhost:4000");
  }
}
