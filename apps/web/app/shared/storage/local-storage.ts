export function readLocal<Value>(key: string, parse: (stored: string | null) => Value): Value {
  try {
    return parse(window.localStorage.getItem(key))
  } catch {
    return parse(null)
  }
}

export function writeLocal(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    return
  }
}
