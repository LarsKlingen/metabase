import { useMemo } from "react";
import { color } from "metabase/lib/colors";
import { formatValue } from "metabase/lib/formatting/value";
import { measureTextWidth } from "metabase/lib/measure-text";
import { getCartesianChartModel } from "metabase/visualizations/echarts/cartesian/model";
import type {
  RenderingContext,
  VisualizationProps,
} from "metabase/visualizations/types";
import { getCartesianChartOption } from "metabase/visualizations/echarts/cartesian/option";
import {
  CartesianChartLegendLayout,
  CartesianChartRenderer,
  CartesianChartRoot,
} from "metabase/visualizations/visualizations/CartesianChart/CartesianChart.styled";
import LegendCaption from "metabase/visualizations/components/legend/LegendCaption";
import { getLegendItems } from "metabase/visualizations/echarts/cartesian/model/legend";
import type { EChartsEventHandler } from "metabase/visualizations/types/echarts";
import {
  getDataFromEChartsEvent,
  getDimensionsFromECharts,
} from "metabase/visualizations/visualizations/CartesianChart/utils";

export function CartesianChart({
  rawSeries,
  settings,
  card,
  fontFamily,
  width,
  showTitle,
  headerIcon,
  actionButtons,
  isQueryBuilder,
  isFullscreen,
  onHoverChange,
  onVisualizationClick,
}: VisualizationProps) {
  const hasTitle = showTitle && settings["card.title"];
  const title = settings["card.title"] || card.name;
  const description = settings["card.description"];

  const renderingContext: RenderingContext = useMemo(
    () => ({
      getColor: color,
      formatValue: (value, options) => String(formatValue(value, options)),
      measureText: measureTextWidth,
      fontFamily: fontFamily,
    }),
    [fontFamily],
  );

  const chartModel = useMemo(
    () => getCartesianChartModel(rawSeries, settings, renderingContext),
    [rawSeries, renderingContext, settings],
  );

  const legendItems = useMemo(() => getLegendItems(chartModel), [chartModel]);
  const hasLegend = legendItems.length > 1;

  const option = useMemo(
    () => getCartesianChartOption(chartModel, settings, renderingContext),
    [chartModel, renderingContext, settings],
  );

  const eventHandlers: EChartsEventHandler[] = [
    {
      eventName: "mouseout",
      handler: () => {
        onHoverChange?.(null);
      },
    },
    {
      eventName: "mousemove",
      handler: event => {
        const data = getDataFromEChartsEvent(event, chartModel);
        onHoverChange?.({
          settings,
          index: 0,
          event: event.event.event,
          data,
        });
      },
    },
    {
      eventName: "click",
      handler: event => {
        const { dataIndex, seriesIndex } = event;

        const datum = chartModel.dataset[dataIndex];

        const data = getDataFromEChartsEvent(event, chartModel);
        const dimensions = getDimensionsFromECharts(event, chartModel);
        const column = chartModel.seriesModels[seriesIndex].column;

        onVisualizationClick?.({
          event: event.event.event,
          value: datum[chartModel.dimensionModel.dataKey],
          column,
          data,
          dimensions,
          settings,
        });
      },
    },
  ];

  return (
    <CartesianChartRoot>
      {hasTitle && (
        <LegendCaption
          title={title}
          description={description}
          icon={headerIcon}
          actionButtons={actionButtons}
          width={width}
        />
      )}
      <CartesianChartLegendLayout
        hasLegend={hasLegend}
        labels={legendItems.map(item => item.name)}
        colors={legendItems.map(item => item.color)}
        actionButtons={!hasTitle ? actionButtons : undefined}
        isFullscreen={isFullscreen}
        isQueryBuilder={isQueryBuilder}
      >
        <CartesianChartRenderer option={option} eventHandlers={eventHandlers} />
      </CartesianChartLegendLayout>
    </CartesianChartRoot>
  );
}
