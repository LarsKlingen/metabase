import { TimeseriesChrome } from "metabase/querying";
import type { QueryClickActionsMode } from "../../types";
import { ColumnFormattingAction } from "../actions/ColumnFormattingAction";
import { HideColumnAction } from "../actions/HideColumnAction";
import { DashboardClickAction } from "../actions/DashboardClickAction";

export const DefaultMode: QueryClickActionsMode = {
  name: "default",
  hasDrills: true,
  clickActions: [
    HideColumnAction,
    ColumnFormattingAction,
    DashboardClickAction,
  ],
  ModeFooter: TimeseriesChrome,
};
