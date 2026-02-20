import { HashAlgorithm } from '@prisma/client'

export const seeded_comments = {
  root: {
    text: 'Seeded root comment for E2E.',
    html: '<p>Seeded root comment for E2E.</p>',
  },
  reply: {
    text: 'Seeded reply comment for E2E.',
    html: '<p>Seeded reply comment for E2E.</p>',
  },
} as const

export const seeded_favorite_item_note = 'Seeded favorite item for E2E tests.'

export const seeded_reportable_resource = {
  platform: ['win'],
  language: ['en'],
  note: 'Seeded reportable resource for E2E report flow.',
}

export const seeded_reportable_resource_file = {
  type: 1,
  file_name: 'seeded-reportable-sample.zip',
  file_path: '/tmp/e2e/seeded-reportable-sample.zip',
  file_size: 2048n,
  file_content_type: 'application/zip',
  hash_algorithm: HashAlgorithm.sha256,
  file_hash: 'e2e-seeded-reportable-hash',
  file_status: 3,
  file_check_status: 1,
  is_virus_false_positive: false,
}

export const seeded_malware_resource = {
  platform: ['win'],
  language: ['en'],
  note: 'Seeded malware review resource for E2E tests.',
}

export const seeded_malware_file = {
  type: 1,
  file_name: 'seeded-malware-sample.zip',
  file_size: 1024n,
  s3_file_key: 'e2e/malware/seeded-malware-sample.zip',
  file_content_type: 'application/zip',
  hash_algorithm: HashAlgorithm.sha256,
  file_hash: 'e2e-seeded-malware-hash',
  file_status: 3,
  file_check_status: 6,
  is_virus_false_positive: false,
}

export const seeded_malware_scan_case = {
  detector: 'clamscan',
  detected_viruses: ['Eicar-Test-Signature'],
  scan_result: {
    engine: 'clamscan',
    infected: true,
    viruses: ['Eicar-Test-Signature'],
  },
  scan_log_path: '/tmp/e2e/clamav.log',
  scan_log_excerpt: '... FOUND: Eicar-Test-Signature ...',
  notify_uploader_on_allow: true,
}
