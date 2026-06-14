"use client";

import { useState } from "react";
import { TrendChart } from "@/components/TrendChart";
import {
  Ch2oReading,
  ReadingStats,
  formatPpm,
  formatTime,
  getLevel,
} from "@/lib/formaldehyde";

export type DevicePanel = {
  tag: string | null;
  label: string;
  color: string;
  readings: Ch2oReading[];
  stats: ReadingStats;
};

type DeviceTabsProps = {
  devices: DevicePanel[];
};

export function DeviceTabs({ devices }: DeviceTabsProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (devices.length === 0) {
    return <div className="empty">Supabase 已连通，但暂时没有有效 ppm 数据。</div>;
  }

  const active = devices[Math.min(activeIndex, devices.length - 1)];
  const level = getLevel(active.stats.latest?.ppmValue ?? null);

  return (
    <div className="device-tabs">
      {devices.length > 1 ? (
        <div className="tab-list" role="tablist" aria-label="设备切换">
          {devices.map((device, index) => {
            const isActive = index === activeIndex;

            return (
              <button
                key={device.label}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`tab${isActive ? " tab-active" : ""}`}
                onClick={() => setActiveIndex(index)}
              >
                <span className="tab-swatch" style={{ background: device.color }} />
                {device.label}
              </button>
            );
          })}
        </div>
      ) : null}

      <div role="tabpanel" aria-label={`${active.label} 数据`}>
        <TrendChart readings={active.readings} color={active.color} />
        <section className="grid device-metrics">
          <MetricCard
            label="当前浓度"
            value={formatPpm(active.stats.latest?.ppmValue ?? null)}
            unit="ppm"
            foot={formatTime(active.stats.latest?.recordedAt ?? null)}
            color={level.color}
          />
          <MetricCard
            label="空气状态"
            value={level.label}
            foot={level.description}
            color={level.color}
          />
          <MetricCard
            label="平均值"
            value={formatPpm(active.stats.average)}
            unit="ppm"
            foot={`该设备最近 ${active.stats.count} 条有效记录`}
          />
          <MetricCard
            label="峰值"
            value={formatPpm(active.stats.maximum?.ppmValue ?? null)}
            unit="ppm"
            foot={formatTime(active.stats.maximum?.recordedAt ?? null)}
          />
        </section>

        <section className="recent-records">
          <div className="recent-records-head">
            <h3>最近记录</h3>
            <div className="muted">优先使用 ppm_ct，无值时回退 create_time。</div>
          </div>
          {active.readings.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>浓度</th>
                </tr>
              </thead>
              <tbody>
                {active.readings
                  .slice(-8)
                  .reverse()
                  .map((reading) => (
                    <tr key={reading.id}>
                      <td>{formatTime(reading.recordedAt)}</td>
                      <td>{formatPpm(reading.ppmValue)} ppm</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">该设备暂时没有有效 ppm 数据。</div>
          )}
        </section>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  unit,
  foot,
  color,
}: {
  label: string;
  value: string;
  unit?: string;
  foot: string;
  color?: string;
}) {
  return (
    <div className="card metric">
      <p className="metric-label">{label}</p>
      <p className="metric-value" style={{ color }}>
        {value} {unit ? <span>{unit}</span> : null}
      </p>
      <p className="metric-foot">{foot}</p>
    </div>
  );
}
