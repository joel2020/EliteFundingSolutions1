export function safePostLoginRedirect(requestedPath: string | null, fallbackPath: string) {
  const allowedRoot = fallbackPath.startsWith('/portal') ? '/portal' : '/crm';
  if (!requestedPath) return fallbackPath;

  try {
    const baseUrl = new URL('https://elite-funding.local');
    const requestedUrl = new URL(requestedPath, baseUrl);
    const isAllowedPath = requestedUrl.pathname === allowedRoot || requestedUrl.pathname.startsWith(`${allowedRoot}/`);

    if (requestedUrl.origin !== baseUrl.origin || !isAllowedPath) return fallbackPath;
    return `${requestedUrl.pathname}${requestedUrl.search}${requestedUrl.hash}`;
  } catch {
    return fallbackPath;
  }
}
