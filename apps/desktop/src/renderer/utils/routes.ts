export function commandPath(id: string) {
  return `/commands/${encodeURIComponent(id)}`;
}
export function pluginPath(id: string) {
  return `/plugins/${encodeURIComponent(id)}`;
}
