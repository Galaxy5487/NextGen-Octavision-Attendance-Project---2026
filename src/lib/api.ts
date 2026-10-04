type ApiOptions = Omit<RequestInit, 'body'> & { body?: any };

export async function api<T = any>(path: string, options?: ApiOptions): Promise<T> {
  const { body, ...rest } = options || {};
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...rest,
    body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}
