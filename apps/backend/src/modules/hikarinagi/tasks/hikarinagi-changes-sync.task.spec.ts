import { HikarinagiChangesSyncTask } from './hikarinagi-changes-sync.task'

describe('HikarinagiChangesSyncTask', () => {
  const createTask = (baseUrl: string) => {
    const changesService = { consume: jest.fn().mockResolvedValue(undefined) }
    const configService = { get: jest.fn().mockReturnValue(baseUrl) }
    const task = new HikarinagiChangesSyncTask(changesService as any, configService as any)

    return { task, changesService, configService }
  }

  it('drains the catalog stream when the upstream is configured', async () => {
    const { task, changesService, configService } = createTask('https://hikarinagi.test')

    await task.handleCron()

    expect(configService.get).toHaveBeenCalledWith('hikarinagi.base_url')
    expect(changesService.consume).toHaveBeenCalledTimes(1)
  })

  it('stays idle when no upstream is configured', async () => {
    const { task, changesService } = createTask('')

    await task.handleCron()

    expect(changesService.consume).not.toHaveBeenCalled()
  })
})
