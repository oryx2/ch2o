import { TrendChart } from "@/components/TrendChart";
import {
  fetchCh2oReadings,
  formatPpm,
  formatTime,
  getLevel,
  getReadingStats,
} from "@/lib/formaldehyde";

export const dynamic = "force-dynamic";

export default async function Home() {
  try {
    const readings = await fetchCh2oReadings();
    const stats = getReadingStats(readings);
    const level = getLevel(stats.latest?.ppmValue ?? null);
    const recentReadings = readings.slice(-8).reverse();

    return (
      <main className="page">
        <header className="topbar">
          <div className="topbar-title">
            <p className="eyebrow">CH₂O Monitor</p>
            <h1>甲醛数据看板</h1>
          </div>
          <div className="pill">
            <span className="pulse" />
            {formatTime(stats.latest?.recordedAt ?? null)}
          </div>
        </header>

        <section className="card section chart-primary">
          <div className="section-head">
            <div>
              <h2>浓度趋势</h2>
              <div className="muted">按上报时间从旧到新，虚线为 0.08 ppm 参考线。</div>
            </div>
            <span className="badge">ppm_value</span>
          </div>
          <TrendChart readings={readings} />
        </section>

        <section className="grid">
          <MetricCard
            label="当前浓度"
            value={formatPpm(stats.latest?.ppmValue ?? null)}
            unit="ppm"
            foot={level.description}
            color={level.color}
          />
          <MetricCard
            label="空气状态"
            value={level.label}
            foot="按 ppm 阈值粗略分级"
            color={level.color}
          />
          <MetricCard
            label="平均值"
            value={formatPpm(stats.average)}
            unit="ppm"
            foot={`最近 ${stats.count} 条有效记录`}
          />
          <MetricCard
            label="峰值"
            value={formatPpm(stats.maximum?.ppmValue ?? null)}
            unit="ppm"
            foot={formatTime(stats.maximum?.recordedAt ?? null)}
          />
        </section>

        <section className="card section">
          <div className="section-head">
            <div>
              <h2>最近记录</h2>
              <div className="muted">优先使用 ppm_ct，无值时回退 create_time。</div>
            </div>
          </div>
          {recentReadings.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>浓度</th>
                </tr>
              </thead>
              <tbody>
                {recentReadings.map((reading) => (
                  <tr key={reading.id}>
                    <td>{formatTime(reading.recordedAt)}</td>
                    <td>{formatPpm(reading.ppmValue)} ppm</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">Supabase 已连通，但暂时没有有效 ppm 数据。</div>
          )}
        </section>

        <p className="footer">
          数据来自 Supabase <code>public.ch2o</code>，约 30 秒自动刷新。
        </p>
      </main>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";

    return (
      <main className="page">
        <section className="hero">
          <div>
            <p className="eyebrow">CH₂O Monitor</p>
            <h1>甲醛数据看板</h1>
            <p className="subtitle">页面已经搭好，但读取 Supabase 时遇到一点小绊脚石。</p>
          </div>
        </section>
        <div className="error">
          <strong>无法加载数据：</strong>
          {message}
        </div>
      </main>
    );
  }
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
