import { shionlibRequest } from '@/utils/request'
import { StatsOverview, StatsTrend } from '@/interfaces/admin/stats.interface'
import { StatsCardGrid } from '@/components/admin/dashboard/StatsCardGrid'
import { TrendChart } from '@/components/admin/dashboard/TrendChart'

async function getAdminStats() {
  const [overviewRes, trendsRes] = await Promise.all([
    shionlibRequest().get<StatsOverview>('/admin/stats/overview'),
    shionlibRequest().get<StatsTrend[]>('/admin/stats/trends', {
      params: { days: 30 },
    }),
  ])

  return {
    overview: overviewRes.data,
    trends: trendsRes.data,
  }
}

export default async function AdminDashboardPage() {
  const { overview, trends } = await getAdminStats()

  return (
    <div className="space-y-6">
      <StatsCardGrid data={overview ?? undefined} />
      <TrendChart data={trends ?? undefined} />
    </div>
  )
}
