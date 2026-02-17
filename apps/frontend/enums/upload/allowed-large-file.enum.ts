export enum AllowedLargeArchiveFileMimeTypes {
  'application/zip' = 'application/zip',
  'application/x-zip-compressed' = 'application/x-zip-compressed',
  'application/x-rar' = 'application/x-rar',
  'application/vnd.rar' = 'application/vnd.rar',
  'application/x-rar-compressed' = 'application/x-rar-compressed',
  'application/x-compressed' = 'application/x-compressed',
  'application/x-7z-compressed' = 'application/x-7z-compressed',
  'application/x-tar' = 'application/x-tar',
  'application/x-gzip' = 'application/x-gzip',
  'application/gzip' = 'application/gzip',
}

export const AllowedLargeArchiveFileExtensions = ['.zip', '.rar', '.7z', '.tar', '.gzip'] as const
