import compatData from '@mdn/browser-compat-data' with { type: 'json' }

const instances = { document: 'Document', navigator: 'Navigator', window: 'Window' }

function compareVersions(left, right) {
  const a = left.split('.').map(Number)
  const b = right.split('.').map(Number)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const difference = (a[i] ?? 0) - (b[i] ?? 0)
    if (difference !== 0) {
      return difference
    }
  }
  return 0
}

function supports(statement, floor) {
  if (statement.flags || statement.prefix || statement.alternative_name) {
    return false
  }
  const added = statement.version_added
  if (typeof added !== 'string' && added !== true) {
    return false
  }
  if (
    typeof added === 'string' &&
    (added === 'preview' || compareVersions(added.replace('≤', ''), floor) > 0)
  ) {
    return false
  }
  const removed = statement.version_removed
  return typeof removed !== 'string' || compareVersions(removed, floor) > 0
}

function missingIn(compat, floors) {
  return Object.entries(floors)
    .filter(([browser, floor]) => {
      const support = compat.support[browser]
      return (
        support !== undefined && ![support].flat().some(statement => supports(statement, floor))
      )
    })
    .map(([browser, floor]) => `${browser} ${floor}`)
}

function globalCompat(name) {
  return compatData.api[name]?.__compat ?? compatData.javascript.builtins[name]?.__compat
}

function memberCompat(owner, property) {
  if (Object.hasOwn(instances, owner)) {
    return compatData.api[instances[owner]]?.[property]?.__compat
  }
  return (
    compatData.api[owner]?.[`${property}_static`]?.__compat ??
    compatData.javascript.builtins[owner]?.[property]?.__compat
  )
}

function isGlobal(sourceCode, identifier) {
  for (let scope = sourceCode.getScope(identifier); scope; scope = scope.upper) {
    const variable = scope.set.get(identifier.name)
    if (variable) {
      return variable.defs.length === 0
    }
  }
  return true
}

export const browserSupport = {
  meta: {
    type: 'problem',
    docs: { description: 'Use only browser APIs that every supported browser in browsers.ts has.' },
    messages: {
      missing:
        '{{name}} is not available in {{browsers}}; the supported browsers are listed in browsers.ts.',
    },
    schema: [{ type: 'object', additionalProperties: { type: 'string' } }],
  },
  create(context) {
    const floors = context.options[0] ?? {}
    const check = (node, name, compat) => {
      const browsers = compat ? missingIn(compat, floors) : []
      if (browsers.length > 0) {
        context.report({
          node,
          messageId: 'missing',
          data: { name, browsers: browsers.join(', ') },
        })
      }
      return browsers.length > 0
    }
    const global = identifier => isGlobal(context.sourceCode, identifier)
    return {
      'MemberExpression[computed=false][object.type="Identifier"][property.type="Identifier"]'(
        node,
      ) {
        const owner = node.object.name
        if (!global(node.object) || check(node.object, owner, globalCompat(owner))) {
          return
        }
        check(node, `${owner}.${node.property.name}`, memberCompat(owner, node.property.name))
      },
      ':matches(CallExpression, NewExpression) > Identifier.callee'(node) {
        if (global(node)) {
          check(node, node.name, globalCompat(node.name))
        }
      },
    }
  },
}
