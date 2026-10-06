import { hashFile } from './upload-hash'
import { hashJobFrom, type HashReport } from './upload.schema'

addEventListener('message', (event: MessageEvent<unknown>) => {
  const job = hashJobFrom(event.data)
  const send = (report: HashReport) => postMessage(report)
  hashFile(job.file, job.chunkSize, send).catch((error: unknown) =>
    send({ kind: 'error', message: String(error) }),
  )
})
