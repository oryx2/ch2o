export type Ch2oReading = {
  id: number;
  ppmValue: number;
  recordedAt: string;
  tag: string | null;
};

type SupabaseCh2oRow = {
  id: number;
  ppm_value: string | number | null;
  ppm_ct: string | null;
  create_time: string | null;
  tag: string | null;
};

export type ReadingStats = {
  latest: Ch2oReading | null;
  average: number | null;
  maximum: Ch2oReading | null;
  minimum: Ch2oReading | null;
  count: number;
};

const DEFAULT_TABLE = "ch2o";
const DEFAULT_TIMESTAMP_COLUMN = "ppm_ct";
const DEFAULT_FALLBACK_TIMESTAMP_COLUMN = "create_time";
const DEFAULT_VALUE_COLUMN = "ppm_value";
const DEFAULT_TAG_COLUMN = "tag";
const DEFAULT_LIMIT = 120;

export async function fetchCh2oReadings(): Promise<Ch2oReading[]> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("缺少 SUPABASE_URL 或 SUPABASE_ANON_KEY 环境变量。");
  }

  const table = process.env.FORMALDEHYDE_TABLE || DEFAULT_TABLE;
  const timestampColumn =
    process.env.FORMALDEHYDE_TIMESTAMP_COLUMN || DEFAULT_TIMESTAMP_COLUMN;
  const fallbackTimestampColumn =
    process.env.FORMALDEHYDE_FALLBACK_TIMESTAMP_COLUMN ||
    DEFAULT_FALLBACK_TIMESTAMP_COLUMN;
  const valueColumn = process.env.FORMALDEHYDE_VALUE_COLUMN || DEFAULT_VALUE_COLUMN;
  const tagColumn = process.env.FORMALDEHYDE_TAG_COLUMN || DEFAULT_TAG_COLUMN;
  const limit = Number(process.env.FORMALDEHYDE_LIMIT || DEFAULT_LIMIT);

  const selectColumns = ["id", valueColumn, timestampColumn, fallbackTimestampColumn, tagColumn]
    .filter((column, index, columns) => column && columns.indexOf(column) === index)
    .join(",");
  const query = new URL(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/${table}`);

  query.searchParams.set("select", selectColumns);
  query.searchParams.set("order", `${timestampColumn}.desc.nullslast`);
  query.searchParams.set("limit", String(Number.isFinite(limit) ? limit : DEFAULT_LIMIT));

  const response = await fetch(query, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
    next: {
      revalidate: 30,
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase 查询失败：${response.status} ${detail}`);
  }

  const rows = (await response.json()) as SupabaseCh2oRow[];

  return rows
    .map((row) => {
      const value = Number(row.ppm_value);
      const recordedAt = row.ppm_ct || row.create_time;

      if (!Number.isFinite(value) || !recordedAt) {
        return null;
      }

      return {
        id: row.id,
        ppmValue: value,
        recordedAt,
        tag: row.tag?.trim() || null,
      };
    })
    .filter((reading): reading is Ch2oReading => Boolean(reading))
    .sort(
      (left, right) =>
        new Date(left.recordedAt).getTime() - new Date(right.recordedAt).getTime(),
    );
}

export function formatTag(tag: string | null): string {
  return tag ?? "默认设备";
}

export function groupReadingsByTag(readings: Ch2oReading[]): Map<string | null, Ch2oReading[]> {
  const groups = new Map<string | null, Ch2oReading[]>();

  for (const reading of readings) {
    const bucket = groups.get(reading.tag) ?? [];
    bucket.push(reading);
    groups.set(reading.tag, bucket);
  }

  return groups;
}

export function getReadingStats(readings: Ch2oReading[]): ReadingStats {
  if (readings.length === 0) {
    return {
      latest: null,
      average: null,
      maximum: null,
      minimum: null,
      count: 0,
    };
  }

  const latest = readings[readings.length - 1];
  const total = readings.reduce((sum, reading) => sum + reading.ppmValue, 0);

  return {
    latest,
    average: total / readings.length,
    maximum: readings.reduce((max, reading) =>
      reading.ppmValue > max.ppmValue ? reading : max,
    ),
    minimum: readings.reduce((min, reading) =>
      reading.ppmValue < min.ppmValue ? reading : min,
    ),
    count: readings.length,
  };
}

export function getLevel(value: number | null): {
  label: string;
  color: string;
  description: string;
} {
  if (value === null) {
    return {
      label: "暂无数据",
      color: "var(--muted)",
      description: "等待传感器上报",
    };
  }

  if (value < 0.08) {
    return {
      label: "良好",
      color: "var(--green)",
      description: "低于常见室内参考限值 0.08 ppm",
    };
  }

  if (value < 0.1) {
    return {
      label: "关注",
      color: "var(--yellow)",
      description: "接近常见室内参考限值",
    };
  }

  if (value < 0.3) {
    return {
      label: "偏高",
      color: "var(--orange)",
      description: "建议加强通风并继续观察",
    };
  }

  return {
    label: "高风险",
    color: "var(--red)",
    description: "建议立即通风并排查污染源",
  };
}

export function formatPpm(value: number | null): string {
  if (value === null) {
    return "--";
  }

  return value.toFixed(3);
}

export const DEVICE_COLORS = ["#67e8f9", "#4ade80", "#fb923c", "#c084fc", "#f472b6"] as const;

export function getDeviceColor(_tag: string | null, index: number): string {
  return DEVICE_COLORS[index % DEVICE_COLORS.length];
}

export function formatTime(value: string | null): string {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}
