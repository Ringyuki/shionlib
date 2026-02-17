// export async function withDomEnv<T>(fn: (win: Window, doc: Document) => T): Promise<T> {
//   const { JSDOM } = await import('jsdom')
//   const dom = new JSDOM('<!doctype html><html><body></body></html>', {
//     url: 'http://localhost/',
//     pretendToBeVisual: true,
//   })
//   const win = dom.window as unknown as Window
//   const doc = win.document

//   const backup: Record<string, any> = {
//     window: globalThis.window,
//     document: globalThis.document,
//     Node: globalThis.Node,
//     Element: globalThis.Element,
//     Text: globalThis.Text,
//     DocumentFragment: globalThis.DocumentFragment,
//     DOMParser: globalThis.DOMParser,
//     getSelection: globalThis.getSelection,
//   }

//   Object.assign(globalThis, {
//     window: win,
//     document: doc,
//     Node: (win as any).Node,
//     Element: (win as any).Element,
//     Text: (win as any).Text,
//     DocumentFragment: (win as any).DocumentFragment,
//     DOMParser: (win as any).DOMParser,
//     getSelection: win.getSelection?.bind(win),
//   })

//   try {
//     return fn(win, doc)
//   } finally {
//     Object.assign(globalThis as any, backup)
//     dom.window.close()
//   }
// }
export async function withDomEnv<T>(
  fn: (win: Window, doc: Document) => T | Promise<T>,
): Promise<T> {
  const { parseHTML } = await import('linkedom')
  const { window, document } = parseHTML('<!doctype html><html><body></body></html>')
  const win = window
  const doc = document

  Object.assign(globalThis, {
    window: win,
    document: doc,
    Node: (win as any).Node,
    Element: (win as any).Element,
    Text: (win as any).Text,
    DocumentFragment: (win as any).DocumentFragment,
    DOMParser: (win as any).DOMParser,
    getSelection: win.getSelection?.bind(win),
  })

  return await fn(win as Window, doc)
}
