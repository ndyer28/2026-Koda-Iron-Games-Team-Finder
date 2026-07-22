// Remembers the manage_token after someone clicks a confirm or manage link,
// so the site knows them on that browser without any account.
//
// This is not a credential the browser invents — it's the same token we
// emailed. Storing it locally just saves the round trip back to the inbox.
//
// Per-browser by design. A different device won't know them; that's what
// /recover is for.

const KEY = 'tf.manage_token'

export function rememberToken(token: string): void {
  try {
    if (/^[0-9a-f-]{36}$/i.test(token)) localStorage.setItem(KEY, token)
  } catch {
    // Private mode / storage disabled. The app still works via email links.
  }
}

export function getToken(): string | null {
  try {
    const t = localStorage.getItem(KEY)
    return t && /^[0-9a-f-]{36}$/i.test(t) ? t : null
  } catch {
    return null
  }
}

export function forgetToken(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // nothing to do
  }
}
