import DashboardStats from "@/components/DashboardStats";
import TrafficChart from "@/components/TrafficChart";

export default function LandscapingView() {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Local Landscaping</h1>
          <p className="text-gray-400 mt-1">Monitoring local SEO pushes and Google My Business leads.</p>
        </div>
        <div className="bg-accent/10 text-accent px-4 py-2 rounded-full text-sm font-medium">
          Agent Status: Scraping Local Maps
        </div>
      </div>

      <DashboardStats campaignType="local_seo" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TrafficChart />
        </div>
        <div className="bg-card rounded-xl p-6 border border-border">
          <h3 className="text-lg font-semibold text-white mb-4">GMB Leads</h3>
          <div className="space-y-4">
            <div className="flex flex-col gap-1 pb-4 border-b border-border">
              <span className="text-sm font-medium text-gray-200">Green Thumb Services</span>
              <span className="text-xs text-gray-400">Orlando, FL</span>
              <span className="inline-flex mt-1 items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 w-fit">
                Booked
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
