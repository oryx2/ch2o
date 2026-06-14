import { DeviceTabs } from "@/components/DeviceTabs";
import {
  fetchCh2oReadings,
  formatTag,
  formatTime,
  getDeviceColor,
  getReadingStats,
  groupReadingsByTag,
} from "@/lib/formaldehyde";

export const dynamic = "force-dynamic";

export default async function Home() {
  try {
    const readings = await fetchCh2oReadings();
    const groups = groupReadingsByTag(readings);
    const deviceTags = Array.from(groups.keys()).sort((left, right) =>
      formatTag(left).localeCompare(formatTag(right), "zh-CN"),
    );
    const devicePanels = deviceTags.map((tag, index) => ({
      tag,
      label: formatTag(tag),
      color: getDeviceColor(tag, index),
      readings: groups.get(tag) ?? [],
      stats: getReadingStats(groups.get(tag) ?? []),
    }));

    return (
      <main className="page">
        <header className="topbar">
          <div className="topbar-title">
            <p className="eyebrow">CH₂O Monitor</p>
            <h1>甲醛数据看板</h1>
          </div>
          <div className="pill">
            <span className="pulse" />
            {deviceTags.length > 1
              ? `${deviceTags.length} 台设备`
              : formatTime(readings[readings.length - 1]?.recordedAt ?? null)}
          </div>
        </header>

        <section className="card section chart-primary">
          <div className="section-head">
            <div>
              <h2>浓度趋势</h2>
              <div className="muted">
                使用 Tab 切换设备；tag 为空时显示为「默认设备」。
              </div>
            </div>
            <span className="badge">ppm_value</span>
          </div>
          <DeviceTabs devices={devicePanels} />
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
