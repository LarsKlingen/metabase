import type * as Lib from "metabase-lib";
import type { FilterOperatorOption } from "../types";

export interface OperatorOption
  extends FilterOperatorOption<Lib.TimeFilterOperatorName> {
  valueCount: number;
}
