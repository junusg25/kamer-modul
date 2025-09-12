import React from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { StatsCards } from '@/components/dashboard/stats-cards'
import { RecentActivity } from '@/components/dashboard/recent-activity'
import { PriorityAlerts } from '@/components/dashboard/priority-alerts'
import { TicketsChart, RevenueChart, StatusChart, CategoryChart } from '@/components/dashboard/charts'
import { useAuth } from '@/contexts/auth-context'

export default function Dashboard() {
  const { user } = useAuth()

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {user?.name || 'User'}! Here's what's happening with your repair shop today.
          </p>
        </div>

        {/* Stats Cards */}
        <StatsCards />

        {/* Main Content Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Recent Activity */}
          <div className="lg:col-span-2">
            <RecentActivity />
          </div>

          {/* Priority Alerts */}
          <div>
            <PriorityAlerts />
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid gap-6 md:grid-cols-2">
          <TicketsChart />
          <RevenueChart />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <StatusChart />
          <CategoryChart />
        </div>
      </div>
    </MainLayout>
  )
}
