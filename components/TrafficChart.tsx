"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";

const data = [
  { name: "Mon", traffic: 4000, conversions: 240 },
  { name: "Tue", traffic: 3000, conversions: 139 },
  { name: "Wed", traffic: 2000, conversions: 980 },
  { name: "Thu", traffic: 2780, conversions: 390 },
  { name: "Fri", traffic: 1890, conversions: 480 },
  { name: "Sat", traffic: 2390, conversions: 380 },
  { name: "Sun", traffic: 3490, conversions: 430 },
];

export default function TrafficChart() {
  return (
    <div className="bg-card rounded-xl p-6 border border-border h-[400px]">
      <h3 className="text-lg font-semibold text-white mb-6">Daily Traffic & Conversions</h3>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{
            top: 10,
            right: 30,
            left: 0,
            bottom: 0,
          }}
        >
          <defs>
            <linearGradient id="colorTraffic" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorConversions" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#2e3445" vertical={false} />
          <XAxis dataKey="name" stroke="#64748b" tick={{fill: '#64748b'}} />
          <YAxis stroke="#64748b" tick={{fill: '#64748b'}} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#1e222d', borderColor: '#2e3445', color: '#fff' }}
            itemStyle={{ color: '#e2e8f0' }}
          />
          <Area
            type="monotone"
            dataKey="traffic"
            stroke="#3b82f6"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorTraffic)"
          />
          <Area
            type="monotone"
            dataKey="conversions"
            stroke="#10b981"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorConversions)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
