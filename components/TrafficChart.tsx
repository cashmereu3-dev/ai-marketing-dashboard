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

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const mockData: Record<string, { name: string; traffic: number; conversions: number }[]> = {
  b2b_outreach: [
    { name: "Mon", traffic: 4000, conversions: 240 },
    { name: "Tue", traffic: 3000, conversions: 139 },
    { name: "Wed", traffic: 2000, conversions: 980 },
    { name: "Thu", traffic: 2780, conversions: 390 },
    { name: "Fri", traffic: 1890, conversions: 480 },
    { name: "Sat", traffic: 2390, conversions: 380 },
    { name: "Sun", traffic: 3490, conversions: 430 },
  ],
  music_promo: [
    { name: "Mon", traffic: 12000, conversions: 840 },
    { name: "Tue", traffic: 15000, conversions: 1100 },
    { name: "Wed", traffic: 18000, conversions: 1490 },
    { name: "Thu", traffic: 14000, conversions: 980 },
    { name: "Fri", traffic: 16500, conversions: 1200 },
    { name: "Sat", traffic: 21000, conversions: 1900 },
    { name: "Sun", traffic: 25000, conversions: 2300 },
  ],
  local_seo: [
    { name: "Mon", traffic: 450, conversions: 12 },
    { name: "Tue", traffic: 520, conversions: 18 },
    { name: "Wed", traffic: 610, conversions: 22 },
    { name: "Thu", traffic: 480, conversions: 15 },
    { name: "Fri", traffic: 580, conversions: 24 },
    { name: "Sat", traffic: 710, conversions: 35 },
    { name: "Sun", traffic: 680, conversions: 28 },
  ],
  drone_promo: [
    { name: "Mon", traffic: 8000, conversions: 350 },
    { name: "Tue", traffic: 9200, conversions: 410 },
    { name: "Wed", traffic: 7800, conversions: 290 },
    { name: "Thu", traffic: 10500, conversions: 520 },
    { name: "Fri", traffic: 11000, conversions: 610 },
    { name: "Sat", traffic: 13000, conversions: 780 },
    { name: "Sun", traffic: 12500, conversions: 720 },
  ],
};

interface TrafficChartProps {
  campaignType: string;
}

export default function TrafficChart({ campaignType }: TrafficChartProps) {
  const [chartData, setChartData] = useState<{ name: string; traffic: number; conversions: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChartData = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("daily_metrics")
          .select("date, traffic, conversions")
          .eq("campaign_type", campaignType)
          .order("date", { ascending: true })
          .limit(7);

        if (error || !data || data.length === 0) {
          // Fallback to mock data scoped to campaignType
          setChartData(mockData[campaignType] || mockData.b2b_outreach);
        } else {
          // Format date to weekday
          const formatted = data.map((item) => {
            const date = new Date(item.date);
            const weekday = date.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
            return {
              name: weekday,
              traffic: item.traffic,
              conversions: item.conversions,
            };
          });
          setChartData(formatted);
        }
      } catch (e) {
        setChartData(mockData[campaignType] || mockData.b2b_outreach);
      } finally {
        setLoading(false);
      }
    };

    fetchChartData();

    // Subscribe to real-time changes
    const channel = supabase
      .channel(`chart-channel-${campaignType}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_metrics" }, fetchChartData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignType]);
  return (
    <div className="bg-card rounded-xl p-6 border border-border h-[400px]">
      <h3 className="text-lg font-semibold text-white mb-6">Daily Traffic & Conversions</h3>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
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
