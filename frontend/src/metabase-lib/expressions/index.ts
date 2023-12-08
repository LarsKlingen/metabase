export * from "./config";

import { FK_SYMBOL } from "metabase/lib/formatting";
import type { Expression } from "metabase-types/api";
import * as Lib from "metabase-lib";
import Dimension from "metabase-lib/Dimension";
import type Metric from "metabase-lib/metadata/Metric";
import type Segment from "metabase-lib/metadata/Segment";
import {
  OPERATORS,
  FUNCTIONS,
  EDITOR_QUOTES,
  EDITOR_FK_SYMBOLS,
  getMBQLName,
} from "./config";

// Return a copy with brackets (`[` and `]`) being escaped
function escapeString(string: string) {
  let str = "";
  for (let i = 0; i < string.length; ++i) {
    const ch = string[i];
    if (ch === "[" || ch === "]") {
      str += "\\";
    }
    str += ch;
  }
  return str;
}

// The opposite of escapeString
export function unescapeString(string: string) {
  let str = "";
  for (let i = 0; i < string.length; ++i) {
    const ch1 = string[i];
    const ch2 = string[i + 1];
    if (ch1 === "\\" && (ch2 === "[" || ch2 === "]")) {
      // skip
    } else {
      str += ch1;
    }
  }
  return str;
}

// IDENTIFIERS

// can be double-quoted, but are not by default unless they have non-word characters or are reserved
export function formatIdentifier(
  name: string,
  { quotes = EDITOR_QUOTES } = {},
) {
  if (
    !quotes.identifierAlwaysQuoted &&
    /^\w+$/.test(name) &&
    !isReservedWord(name)
  ) {
    return name;
  }
  return quoteString(name, quotes.identifierQuoteDefault);
}

function isReservedWord(word: string) {
  return !!getMBQLName(word);
}

// METRICS

export function parseMetric(
  metricName: string,
  { query, stageIndex }: { query: Lib.Query; stageIndex: number },
) {
  const metrics = Lib.availableMetrics(query);

  const metric = metrics.find(metric => {
    const displayInfo = Lib.displayInfo(
      query as Lib.Query,
      stageIndex as number,
      metric,
    );

    return displayInfo.displayName.toLowerCase() === metricName.toLowerCase();
  });

  if (metric) {
    // @uladzimirdev fix a type of the metric
    const legacyExpression = Lib.legacyExpressionForExpressionClause(
      query,
      stageIndex,
      metric as any,
    );

    return legacyExpression;
  }
}

export function formatMetricName(metric: Metric, options: Record<string, any>) {
  return formatIdentifier(metric.name, options);
}

// SEGMENTS
export function parseSegment(
  segmentName: string,
  { query, stageIndex }: { query: Lib.Query; stageIndex: number },
) {
  const segment = Lib.availableSegments(query, stageIndex).find(segment => {
    const displayInfo = Lib.displayInfo(query, stageIndex, segment);

    return displayInfo.displayName.toLowerCase() === segmentName.toLowerCase();
  });

  if (segment) {
    // @uladzimirdev fix a type of the segment
    const legacyExpression = Lib.legacyExpressionForExpressionClause(
      query,
      stageIndex,
      segment as any,
    );

    return legacyExpression;
  }

  const column = Lib.fieldableColumns(query, stageIndex).find(field => {
    const displayInfo = Lib.displayInfo(query, stageIndex, field);
    return displayInfo.name.toLowerCase() === segmentName.toLowerCase();
  });

  if (column && Lib.isBoolean(column)) {
    // @uladzimirdev fix a type of the column
    const legacyExpression = Lib.legacyExpressionForExpressionClause(
      query,
      stageIndex,
      column as any,
    );

    return legacyExpression;
  }
}

export function formatSegmentName(
  segment: Segment,
  options: Record<string, any>,
) {
  return formatIdentifier(segment.name, options);
}

// DIMENSIONS

/**
 * Find dimension with matching `name` in query. TODO - How is this "parsing" a dimension? Not sure about this name.
 */
export function parseDimension(
  name: string,
  {
    reference,
    query,
    stageIndex,
    source,
  }: {
    reference: string;
    query: Lib.Query;
    stageIndex: number;
    source: string;
  },
) {
  const columns = Lib.expressionableColumns(query, stageIndex, source.length);

  return columns
    .filter(column => {
      const displayInfo = Lib.displayInfo(query, stageIndex, column);

      const nameWithSeparator = getDisplayNameWithSeparator(
        displayInfo.longDisplayName,
      );

      return nameWithSeparator !== reference;
    })
    .find(column => {
      const displayInfo = Lib.displayInfo(query, stageIndex, column);

      return EDITOR_FK_SYMBOLS.symbols.some(
        separator =>
          getDisplayNameWithSeparator(displayInfo.displayName, separator) ===
          name,
      );
    });
}

export function formatDimensionName(dimension: Dimension, options: object) {
  return formatIdentifier(getDimensionName(dimension), options);
}

/**
 * TODO -- this doesn't really return the dimension *name*, does it? It returns the 'rendered' dimension description
 * with the FK symbol (→) replaced with a different character.
 */
export function getDimensionName(
  dimension: Dimension,
  separator = EDITOR_FK_SYMBOLS.default,
) {
  return dimension.render().replace(` ${FK_SYMBOL} `, separator);
}

export function getDisplayNameWithSeparator(
  displayName: string,
  separator = EDITOR_FK_SYMBOLS.default,
) {
  return displayName.replace(` ${FK_SYMBOL} `, separator);
}

// STRING LITERALS

export function formatStringLiteral(
  mbqlString: string,
  { quotes = EDITOR_QUOTES } = {},
) {
  return quoteString(mbqlString, quotes.literalQuoteDefault);
}

const DOUBLE_QUOTE = '"';
const SINGLE_QUOTE = "'";
const BACKSLASH = "\\";

const STRING_ESCAPE: Record<string, string> = {
  "\b": "\\b",
  "\t": "\\t",
  "\n": "\\n",
  "\f": "\\f",
  "\r": "\\r",
};

const STRING_UNESCAPE: Record<string, string> = {
  b: "\b",
  t: "\t",
  n: "\n",
  f: "\f",
  r: "\r",
};

export function quoteString(string: string, quote: string) {
  if (quote === DOUBLE_QUOTE || quote === SINGLE_QUOTE) {
    let str = "";
    for (let i = 0; i < string.length; ++i) {
      const ch = string[i];
      if (ch === quote && string[i - 1] !== BACKSLASH) {
        str += BACKSLASH + ch;
      } else {
        const sub = STRING_ESCAPE[ch];
        str += sub ? sub : ch;
      }
    }
    return quote + str + quote;
  } else if (quote === "[") {
    return "[" + escapeString(string) + "]";
  } else if (quote === "") {
    // unquoted
    return string;
  } else {
    throw new Error("Unknown quoting: " + quote);
  }
}

export function unquoteString(string: string) {
  const quote = string.charAt(0);
  if (quote === DOUBLE_QUOTE || quote === SINGLE_QUOTE) {
    let str = "";
    for (let i = 1; i < string.length - 1; ++i) {
      const ch = string[i];
      if (ch === BACKSLASH) {
        const seq = string[i + 1];
        const unescaped = STRING_UNESCAPE[seq];
        if (unescaped) {
          str += unescaped;
          ++i;
          continue;
        }
      }
      str += ch;
    }
    return str;
  } else if (quote === "[") {
    return unescapeString(string).slice(1, -1);
  } else {
    throw new Error("Unknown quoting: " + string);
  }
}

// move to query lib

export function isExpression(expr: unknown): expr is Expression {
  return (
    isLiteral(expr) ||
    isOperator(expr) ||
    isFunction(expr) ||
    isDimension(expr) ||
    isBooleanLiteral(expr) ||
    isMetric(expr) ||
    isSegment(expr) ||
    isCase(expr)
  );
}

export function isLiteral(expr: unknown): boolean {
  return isStringLiteral(expr) || isNumberLiteral(expr);
}

export function isStringLiteral(expr: unknown): boolean {
  return typeof expr === "string";
}

export function isBooleanLiteral(expr: unknown): boolean {
  return typeof expr === "boolean";
}

export function isNumberLiteral(expr: unknown): boolean {
  return typeof expr === "number";
}

export function isOperator(expr: unknown): boolean {
  return (
    Array.isArray(expr) &&
    OPERATORS.has(expr[0]) &&
    expr
      .slice(1, hasOptions(expr) ? -1 : 0) // skip options object at the end
      .every(isExpression)
  );
}

function isPlainObject(obj: unknown): boolean {
  return obj ? Object.getPrototypeOf(obj) === Object.prototype : false;
}

export function hasOptions(expr: unknown): boolean {
  return Array.isArray(expr) && isPlainObject(expr[expr.length - 1]);
}

export function isFunction(expr: unknown): boolean {
  return (
    Array.isArray(expr) &&
    FUNCTIONS.has(expr[0]) &&
    expr
      .slice(1, hasOptions(expr) ? -1 : 0) // skip options object at the end
      .every(isExpression)
  );
}

export function isDimension(expr: unknown): boolean {
  // @ts-expect-error parseMBQL doesn't accept Expr
  return !!Dimension.parseMBQL(expr);
}

export function isMetric(expr: unknown): boolean {
  return (
    Array.isArray(expr) &&
    expr[0] === "metric" &&
    expr.length === 2 &&
    typeof expr[1] === "number"
  );
}

export function isSegment(expr: unknown): boolean {
  return (
    Array.isArray(expr) &&
    expr[0] === "segment" &&
    expr.length === 2 &&
    typeof expr[1] === "number"
  );
}

export function isCase(expr: unknown): boolean {
  return Array.isArray(expr) && expr[0] === "case"; // && _.all(expr.slice(1), isValidArg)
}
