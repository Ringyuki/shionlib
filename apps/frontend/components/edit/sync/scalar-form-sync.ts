export const isScalarValueEqual = <TValue>(left: TValue, right: TValue) => {
  if (Object.is(left, right)) return true
  return JSON.stringify(left) === JSON.stringify(right)
}

export const mergeScalarFields = <
  TScalar extends Record<string, any>,
  TField extends keyof TScalar,
>(
  current: TScalar,
  source: TScalar,
  fields: TField[],
  shouldApply: (field: TField) => boolean = () => true,
): TScalar => {
  const next = { ...current }
  for (const field of fields) {
    if (shouldApply(field)) next[field] = source[field]
  }
  return next
}
