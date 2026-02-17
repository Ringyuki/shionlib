type LastFridays = {
  lastFriday: Date
  thisFriday: Date
}

type LastFridaysWithLabel = LastFridays & {
  monthName: string
  yearName: string
}

const getLastFridayOfMonth = (year: number, month: number): Date => {
  // month: 0-11；new Date(year, month + 1, 0) = this month's last day
  const lastDayOfMonth = new Date(year, month + 1, 0)
  const weekday = lastDayOfMonth.getDay() // 0=Sunday,...,5=Friday

  // go back to the nearest Friday
  const diff = (weekday - 5 + 7) % 7
  lastDayOfMonth.setDate(lastDayOfMonth.getDate() - diff)

  return lastDayOfMonth
}

export function getLastFridays(refDate?: Date): LastFridays
export function getLastFridays(
  refDate: Date | undefined,
  locale: 'zh' | 'ja' | 'en',
): LastFridaysWithLabel
export function getLastFridays(
  refDate: Date = new Date(),
  locale?: 'zh' | 'ja' | 'en',
): LastFridays | LastFridaysWithLabel {
  const year = refDate.getFullYear()
  const month = refDate.getMonth() // 0-11

  // last Friday of the current month
  const thisMonthLastFriday = getLastFridayOfMonth(year, month)

  let lastFriday: Date
  let thisFriday: Date

  if (refDate.getTime() >= thisMonthLastFriday.getTime()) {
    // if today is/later than the last Friday of the current month
    // lastFriday = last Friday of the current month
    lastFriday = thisMonthLastFriday

    // thisFriday = last Friday of the next month
    const nextMonth = month === 11 ? 0 : month + 1
    const nextYear = month === 11 ? year + 1 : year
    thisFriday = getLastFridayOfMonth(nextYear, nextMonth)
  } else {
    // if today is earlier than the last Friday of the current month
    // lastFriday = last Friday of the previous month
    const prevMonth = month === 0 ? 11 : month - 1
    const prevYear = month === 0 ? year - 1 : year
    lastFriday = getLastFridayOfMonth(prevYear, prevMonth)

    // thisFriday = last Friday of the current month
    thisFriday = thisMonthLastFriday
  }

  if (!locale) {
    return { lastFriday, thisFriday }
  }

  const labelDate = new Date(lastFriday.getFullYear(), lastFriday.getMonth(), 1)
  const monthFormatter = new Intl.DateTimeFormat(locale, {
    month: 'long',
  })
  const yearFormatter = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
  })

  const monthName = monthFormatter.format(labelDate)
  const yearName = yearFormatter.format(labelDate)

  return {
    lastFriday,
    thisFriday,
    monthName,
    yearName,
  }
}
