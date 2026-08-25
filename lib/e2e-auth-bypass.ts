export function shouldBypassAuthForE2e(bypassValue: string | undefined, hostname: string) {
  return bypassValue === '1' && ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(hostname.toLowerCase());
}
