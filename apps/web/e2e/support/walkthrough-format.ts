import type { Page } from '@playwright/test'

const started =
  '[{"_1":2},"data",{"_3":4,"_5":6},"ok",true,"result",{"_7":8,"_9":10,"_5":-5},"id","5b0ae0d0-d26a-4ce7-aa78-45c1a26b79f3","state","working"]\n'

export const formatted =
  '[{"_1":2},"routes/resources.walkthroughs.format",{"_3":4},"data",{"_5":6,"_7":8},"ok",true,"result",{"_9":10,"_11":12,"_7":13},"id","5b0ae0d0-d26a-4ce7-aa78-45c1a26b79f3","state","done",{"_14":15,"_16":17},"note",{"_55":56,"_57":58},"routes",[18,19],{"_20":46,"_22":47,"_24":48,"_26":49,"_28":43,"_30":43,"_32":50},{"_20":21,"_22":23,"_24":25,"_26":27,"_28":29,"_30":31,"_32":33},"key","r2","name","真结局","characters",[],"requires",[46],"condition","二周目","ending","真 END","steps",[34,35],{"_36":44,"_38":43,"_40":43,"_42":45},{"_36":37,"_38":39,"_40":41,"_42":43},"kind","choice","text","离开","remark","光线","slot","","load","01","r1","共通线",[],[],[51,52],{"_36":37,"_38":54,"_40":43,"_42":43},{"_36":53,"_38":43,"_40":43,"_42":45},"save","去天文台","type","doc","content",[59],{"_55":60,"_57":61},"paragraph",[62],{"_55":38,"_38":63},"开始之前请先安装修正补丁"]\n'

export const refused =
  '[{"_1":2},"routes/resources.walkthroughs.format",{"_3":4},"data",{"_5":6,"_7":8,"_9":-7,"_10":11},"ok",false,"failure",{"_12":13,"_14":15,"_3":-5,"_16":17,"_18":19},"retryAfter","status",502,"code",560108,"message","整理失败，请稍后再试","requestId","dad1002d-c6b2-4582-9dff-ee9caf8a75bb","timestamp","2026-10-15T06:18:18.838Z"]\n'

const headers = { 'content-type': 'text/x-script', 'x-remix-response': 'yes' }

export async function stubFormatting(page: Page, answer: string) {
  await page.route('**/resources/walkthroughs/format.data**', route =>
    route.request().method() === 'POST'
      ? route.fulfill({ status: 200, headers, body: started })
      : route.fulfill({ status: answer === refused ? 502 : 200, headers, body: answer }),
  )
}
