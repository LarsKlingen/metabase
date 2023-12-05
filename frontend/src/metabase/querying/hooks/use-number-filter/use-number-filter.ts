import { useMemo, useState } from "react";
import * as Lib from "metabase-lib";
import { getAvailableOperatorOptions } from "../utils";
import { OPERATOR_OPTIONS } from "./constants";
import { getDefaultValues, getFilterClause, hasValidValues } from "./utils";
import type { NumberValue } from "./types";

interface UseNumberFilterProps {
  query: Lib.Query;
  stageIndex: number;
  column: Lib.ColumnMetadata;
  filter?: Lib.FilterClause;
  onChange?: (filter: Lib.ExpressionClause) => void;
}

export function useNumberFilter({
  query,
  stageIndex,
  column,
  filter,
  onChange,
}: UseNumberFilterProps) {
  const filterParts = useMemo(
    () => (filter ? Lib.numberFilterParts(query, stageIndex, filter) : null),
    [query, stageIndex, filter],
  );

  const availableOperators = useMemo(
    () =>
      getAvailableOperatorOptions(query, stageIndex, column, OPERATOR_OPTIONS),
    [query, stageIndex, column],
  );

  const [operator, setOperator] = useState(
    filterParts ? filterParts.operator : "=",
  );

  const [values, setValues] = useState(() =>
    getDefaultValues(operator, filterParts?.values),
  );

  const { valueCount, hasMultipleValues } = OPERATOR_OPTIONS[operator];
  const isValid = hasValidValues(operator, values);

  const handleOperatorChange = (newOperator: Lib.NumberFilterOperatorName) => {
    const newValues = getDefaultValues(newOperator, values);
    setOperator(newOperator);
    setValues(newValues);

    if (onChange && hasValidValues(newOperator, newValues)) {
      onChange(getFilterClause(newOperator, column, newValues));
    }
  };

  const handleValuesChange = (newValues: NumberValue[]) => {
    setValues(newValues);

    if (onChange && hasValidValues(operator, newValues)) {
      onChange(getFilterClause(operator, column, newValues));
    }
  };

  return {
    operator,
    availableOperators,
    values,
    valueCount,
    hasMultipleValues,
    isValid,
    getFilterClause: () =>
      isValid ? getFilterClause(operator, column, values) : null,
    handleOperatorChange,
    handleValuesChange,
  };
}
