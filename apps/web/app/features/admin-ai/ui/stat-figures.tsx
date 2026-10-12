import { Card, Grid, Statistic, Text } from '@hina-ui/react'

export type Figure = {
  label: string
  value: string
  note?: string
  worse?: boolean
}

export function StatFigures({ figures }: { figures: Figure[] }) {
  return (
    <Card>
      <Grid gap="none" className="grid-cols-2 gap-x-4 gap-y-5 lg:grid-cols-4">
        {figures.map(figure => (
          <Statistic key={figure.label} label={figure.label} value={figure.value}>
            {figure.note !== undefined && (
              <Text
                as="span"
                size="sm"
                tone={figure.worse === true ? 'danger' : 'muted'}
                className="tabular-nums"
              >
                {figure.note}
              </Text>
            )}
          </Statistic>
        ))}
      </Grid>
    </Card>
  )
}
