type FileBody<Field extends string> = {
  body: Partial<Record<Field, string>>
  bodySerializer: () => FormData
}

export function fileBody<Field extends string>(field: Field, file: File): FileBody<Field> {
  const form = new FormData()
  form.append(field, file, file.name)
  return { body: {}, bodySerializer: () => form }
}
