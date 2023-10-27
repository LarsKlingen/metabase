// eslint-disable-next-line no-restricted-imports -- deprecated usage
import moment from "moment-timezone";
import { t } from "ttag";
import * as Lib from "metabase-lib";
import { formatValue } from "metabase/lib/formatting/value";
import { formatDateTimeRangeWithUnit } from "metabase/lib/formatting/date";
import { color } from "metabase/lib/colors";
import { formatChange } from "metabase/visualizations/visualizations/SmartScalar/utils";
import { isDate } from "metabase-lib/types/utils/isa";

// compute the percent change between two values (a → b)
export function computeChange(a, b) {
  if (a === 0) {
    // a   b     %
    // 0 → - = -∞%
    // 0 → + =  ∞%
    // 0 → 0 =  0%
    return 0 < b ? Infinity : b < 0 ? -Infinity : 0;
  }
  if (b === 0) {
    // a   b       %
    // - → 0 = -100%
    // + → 0 = -100%
    return -1;
  }
  if (0 < a) {
    //  a   b   %
    //  + → + = (b-a)/a
    //  + → - = (b-a)/a
    return (b - a) / a;
  }
  // a   b     b   a
  // - → - =  [+ → +]
  // - → + = -[+ → -]
  return b < 0 ? computeChange(-b, -a) : -computeChange(b, a);
}

export const PREVIOUS_VALUE_MISSING = "PREVIOUS_VALUE_MISSING";
export const PREVIOUS_VALUE_SAME = "PREVIOUS_VALUE_SAME";
export const PREVIOUS_VALUE_CHANGED = "PREVIOUS_VALUE_CHANGED";

function computePreviousPeriodComparison({
  rows,
  metricIndex,
  dimensionIndex,
  nextValue,
  nextDate,
  dateUnit,
  formatOptions,
  settings,
}) {
  const i = rows.findLastIndex(
    (row, i) => i < rows.length - 1 && row[metricIndex] != null,
  );
  const date = rows[i]?.[dimensionIndex];
  const value = rows[i]?.[metricIndex];
  const change = value != null ? computeChange(value, nextValue) : null;

  const title =
    date == null || dateUnit == null
      ? t`previous ${dateUnit ?? t`period`}`
      : moment
          .utc(date)
          .startOf(dateUnit)
          .add(1, dateUnit)
          .isSame(moment.utc(nextDate).startOf(dateUnit))
      ? t`previous ${Lib.describeTemporalUnit(dateUnit).toLowerCase()}`
      : formatDateTimeRangeWithUnit([date], dateUnit, { compact: true }); // FIXME: elide part of the prevDate in common with lastDate

  const { type, changeArrow, changeStr, valueStr } =
    value == null
      ? {
          type: PREVIOUS_VALUE_MISSING,
          changeStr: t`N/A`,
          valueStr: t`(empty)`,
        }
      : change === 0
      ? {
          type: PREVIOUS_VALUE_SAME,
          changeStr: t`No change`,
          valueStr: "",
        }
      : {
          type: PREVIOUS_VALUE_CHANGED,
          changeArrow: change < 0 ? "↓" : "↑",
          changeStr: formatChange(change),
          valueStr: formatValue(value, formatOptions),
        };

  const arrowColorName = !settings["scalar.switch_positive_negative"]
    ? { "↓": "error", "↑": "success" }
    : { "↓": "success", "↑": "error" };
  const changeColor = color(arrowColorName[changeArrow]);

  return {
    type,
    change,
    value,
    title,
    changeColor,
    changeArrow,
    display: {
      change: changeStr,
      value: valueStr,
    },
  };
}

export function computeTrend(series, insights, settings) {
  const [
    {
      data: { rows, cols },
    },
  ] = series;

  // column locations for date and metric
  const dimensionIndex = cols.findIndex(col => isDate(col));
  const metricIndex = cols.findIndex(
    col => col.name === settings["scalar.field"],
  );

  // get metric column metadata
  const metricColumn = cols[metricIndex];
  const metricInsight = insights?.find(
    insight => insight.col === metricColumn.name,
  );
  if (metricInsight == null) {
    return null;
  }

  // get last value and date
  const i = rows.length - 1;
  const date = rows[i]?.[dimensionIndex];
  const value = rows[i]?.[metricIndex];
  if (value == null) {
    return null;
  }

  // format last value and date
  const formatOptions = settings.column?.(metricColumn);
  const dateUnit = metricInsight.unit;
  const valueStr = formatValue(value, formatOptions);
  const dateStr =
    dateUnit &&
    formatDateTimeRangeWithUnit([date], dateUnit, { compact: true });

  const clicked = {
    value,
    column: cols[dimensionIndex],
    dimensions: [
      {
        value: rows[rows.length - 1][dimensionIndex],
        column: cols[dimensionIndex],
      },
    ],
    data: rows[rows.length - 1].map((value, index) => ({
      value,
      col: cols[index],
    })),
    settings,
  };

  const comparison = computePreviousPeriodComparison({
    rows,
    dimensionIndex,
    metricIndex,
    nextValue: value,
    nextDate: date,
    dateUnit,
    formatOptions,
    settings,
  });

  return {
    value,
    clicked,
    formatOptions,
    display: {
      value: valueStr,
      date: dateStr,
    },
    comparison,
  };
}
