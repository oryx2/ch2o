export type Ch2oReading = {
  id: number;
  ppmValue: number | null;
  co2Ppm: number | null;
  aqi: number | null;
  recordedAt: string;
  tag: string | null;
};

type SupabaseCh2oRow = {
  id: number;
  ppm_value: string | number | null;
  co2_ppm: string | number | null;
  aqi: string | number | null;
  ppm_ct: string | null;
  create_time: string | null;
  tag: string | null;
};

const ENS160_TAG_PATTERN = /ens160/i;

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

  const selectColumns = [
    "id",
    valueColumn,
    "co2_ppm",
    "aqi",
    timestampColumn,
    fallbackTimestampColumn,
    tagColumn,
  ]
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
      const tag = row.tag?.trim() || null;
      const ppmValue = parseNumeric(row.ppm_value);
      const co2Ppm = parseNumeric(row.co2_ppm);
      const aqi = parseNumeric(row.aqi);
      const recordedAt = row.ppm_ct || row.create_time;

      if (!recordedAt) {
        return null;
      }

      if (isEns160Tag(tag)) {
        if (ppmValue === null && co2Ppm === null && aqi === null) {
          return null;
        }
      } else if (ppmValue === null) {
        return null;
      }

      return {
        id: row.id,
        ppmValue,
        co2Ppm,
        aqi,
        recordedAt,
        tag,
      };
    })
    .filter((reading): reading is Ch2oReading => Boolean(reading))
    .sort(
      (left, right) =>
        new Date(left.recordedAt).getTime() - new Date(right.recordedAt).getTime(),
    );
}

function parseNumeric(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isEns160Tag(tag: string | null): boolean {
  return Boolean(tag && ENS160_TAG_PATTERN.test(tag));
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
  const ppmReadings = readings.filter((reading) => reading.ppmValue !== null);

  if (ppmReadings.length === 0) {
    return {
      latest,
      average: null,
      maximum: null,
      minimum: null,
      count: readings.length,
    };
  }

  const total = ppmReadings.reduce((sum, reading) => sum + (reading.ppmValue ?? 0), 0);

  return {
    latest,
    average: total / ppmReadings.length,
    maximum: ppmReadings.reduce((max, reading) =>
      (reading.ppmValue ?? -Infinity) > (max.ppmValue ?? -Infinity) ? reading : max,
    ),
    minimum: ppmReadings.reduce((min, reading) =>
      (reading.ppmValue ?? Infinity) < (min.ppmValue ?? Infinity) ? reading : min,
    ),
    count: readings.length,
  };
}

export function getNumericStats(
  readings: Ch2oReading[],
  pick: (reading: Ch2oReading) => number | null,
) {
  const values = readings
    .map(pick)
    .filter((value): value is number => value !== null);

  if (values.length === 0) {
    return {
      latest: null,
      average: null,
      maximum: null,
      minimum: null,
    };
  }

  const total = values.reduce((sum, value) => sum + value, 0);

  return {
    latest: pick(readings[readings.length - 1]),
    average: total / values.length,
    maximum: Math.max(...values),
    minimum: Math.min(...values),
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

export function formatInteger(value: number | null): string {
  if (value === null) {
    return "--";
  }

  return Math.round(value).toString();
}

export function getAqiLevel(value: number | null): {
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

  const rounded = Math.round(value);

  if (rounded <= 1) {
    return {
      label: "优秀",
      color: "var(--green)",
      description: "空气质量优秀",
    };
  }

  if (rounded === 2) {
    return {
      label: "良好",
      color: "var(--cyan)",
      description: "空气质量良好",
    };
  }

  if (rounded === 3) {
    return {
      label: "一般",
      color: "var(--yellow)",
      description: "建议保持通风",
    };
  }

  if (rounded === 4) {
    return {
      label: "较差",
      color: "var(--orange)",
      description: "建议加强通风",
    };
  }

  return {
    label: "很差",
    color: "var(--red)",
    description: "建议立即通风并排查污染源",
  };
}

/** UBA 标准 TVOC 参考线（ppm，对应 ENS160 输出换算） */
export const TVOC_REFERENCE_LINES = [
  { value: 0.065, label: "0.065 ppm 良好", color: "#4ade80" },
  { value: 0.22, label: "0.22 ppm 一般", color: "#facc15" },
  { value: 0.65, label: "0.65 ppm 较差", color: "#fb923c" },
] as const;

export const CH2O_REFERENCE_PPM = 0.08;

export function getTvocLevel(value: number | null): {
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

  if (value < 0.065) {
    return {
      label: "优秀",
      color: "var(--green)",
      description: "低于 0.065 ppm（UBA 优秀）",
    };
  }

  if (value < 0.22) {
    return {
      label: "良好",
      color: "var(--cyan)",
      description: "0.065–0.22 ppm（UBA 良好）",
    };
  }

  if (value < 0.65) {
    return {
      label: "一般",
      color: "var(--yellow)",
      description: "0.22–0.65 ppm，建议加强通风",
    };
  }

  if (value < 2.2) {
    return {
      label: "较差",
      color: "var(--orange)",
      description: "高于 0.65 ppm，建议排查污染源",
    };
  }

  return {
    label: "很差",
    color: "var(--red)",
    description: "高于 2.2 ppm，不宜久留",
  };
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
