interface PayloadBlockProps {
  title: string
  value: Record<string, unknown>
}

export const PayloadBlock = ({ title, value }: PayloadBlockProps) => (
  <div className="rounded-md bg-muted/40 p-2">
    <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      {title}
    </div>
    <pre className="max-h-36 overflow-auto whitespace-pre-wrap wrap-break-word text-xs leading-relaxed">
      {JSON.stringify(value, null, 2)}
    </pre>
  </div>
)
