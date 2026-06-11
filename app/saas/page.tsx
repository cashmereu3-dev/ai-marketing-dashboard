import DashboardStats from "@/components/DashboardStats";
import TrafficChart from "@/components/TrafficChart";

export default function SaaSView() {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Software & SaaS</h1>
          <p className="text-gray-400 mt-1">Monitoring B2B outreach and software campaign metrics.</p>
        </div>
        <div className="bg-accent/10 text-accent px-4 py-2 rounded-full text-sm font-medium">
          Agent Status: Active
        </div>
      </div>

      <DashboardStats campaignType="b2b_outreach" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TrafficChart />
        </div>
        <div className="bg-card rounded-xl p-6 border border-border">
          <h3 className="text-lg font-semibold text-white mb-4">Recent B2B Leads</h3>
          <div className="space-y-4">
            {/* Mock recent leads until we do a full real-time list */}
            <div className="flex flex-col gap-1 pb-4 border-b border-border">
              <span className="text-sm font-medium text-gray-200">Acme Corp</span>
              <span className="text-xs text-gray-400">john.doe@acmecorp.com</span>
              <span className="inline-flex mt-1 items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 w-fit">
                Booked
              </span>
            </div>
            <div className="flex flex-col gap-1 pb-4 border-b border-border">
              <span className="text-sm font-medium text-gray-200">TechFlow Inc</span>
              <span className="text-xs text-gray-400">sarah@techflow.io</span>
              <span className="inline-flex mt-1 items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-500/10 text-yellow-400 w-fit">
                Contacted
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-200">Global Systems</span>
              <span className="text-xs text-gray-400">info@globalsys.net</span>
              <span className="inline-flex mt-1 items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-500/10 text-gray-400 w-fit">
                Cold
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
