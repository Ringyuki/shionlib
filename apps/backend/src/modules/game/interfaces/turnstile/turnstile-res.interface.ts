// {
//   "success": true,
//   "challenge_ts": "2022-02-28T15:14:30.096Z",
//   "hostname": "example.com",
//   "error-codes": [],
//   "action": "login",
//   "cdata": "sessionid-123456789",
//   "metadata": {
//     "ephemeral_id": "x:9f78e0ed210960d7693b167e"
//   }
// }

export interface TurnstileResInterface {
  success: boolean
  challenge_ts: string
  hostname: string
  error_codes: string[]
  action: string
  cdata: string
  metadata: {
    ephemeral_id: string
  }
}
