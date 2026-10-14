import { hashFile } from './upload-hash'
import { hashJobFrom, type HashReport } from './upload.schema'

addEventListener('message', (event: MessageEvent<unknown>) => {
  const job = hashJobFrom(event.data)
  const send = (report: HashReport) => postMessage(report)
  hashFile(job.file, job.chunkSize, send).catch((error: unknown) =>
    send(
      error instanceof Error
        ? { kind: 'error', name: error.name, message: error.message }
        : { kind: 'error', message: String(error) },
    ),
  )
})
