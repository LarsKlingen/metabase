import {
  createOrdersIdDatasetColumn,
  createOrdersIdField,
  createOrdersProductIdDatasetColumn,
  createOrdersProductIdField,
  createOrdersTable,
  createOrdersTotalDatasetColumn,
  createOrdersTotalField,
  createSampleDatabase,
  SAMPLE_DB_ID,
} from "metabase-types/api/mocks/presets";
import { createMockMetadata } from "__support__/metadata";
import * as Lib from "metabase-lib";
import {
  columnFinder,
  createQuery,
  findAggregationOperator,
  findDrillThru,
  queryDrillThru,
} from "metabase-lib/test-helpers";

describe("drill-thru/zoom", () => {
  const drillType = "drill-thru/zoom";
  const defaultQuery = createQuery();
  const stageIndex = 0;
  const defaultColumn = createOrdersIdDatasetColumn();

  describe("availableDrillThrus", () => {
    it("should allow to drill when there is only one PK", () => {
      const query = createQuery();
      const value = 10;
      const row = [{ col: defaultColumn, value }];
      const { drillInfo } = findDrillThru(
        drillType,
        query,
        stageIndex,
        defaultColumn,
        value,
        row,
      );

      expect(drillInfo).toMatchObject({
        type: drillType,
      });
    });

    // eslint-disable-next-line jest/no-disabled-tests
    it.skip("should allow to drill when the column is not a PK or FK and there is another PK (metabase#36129)", () => {
      const value = 10;
      const column = createOrdersTotalDatasetColumn();
      const row = [{ col: column, value }];
      const { drillInfo } = findDrillThru(
        drillType,
        defaultQuery,
        stageIndex,
        column,
        value,
        row,
      );

      expect(drillInfo).toMatchObject({
        type: drillType,
      });
    });

    it("should not allow to drill when the column is not a PK or FK and the query is aggregated", () => {
      const queryWithAggregation = Lib.aggregate(
        defaultQuery,
        stageIndex,
        Lib.aggregationClause(findAggregationOperator(defaultQuery, "count")),
      );
      const queryWithBreakout = Lib.breakout(
        queryWithAggregation,
        stageIndex,
        columnFinder(
          queryWithAggregation,
          Lib.breakoutableColumns(queryWithAggregation, stageIndex),
        )("ORDERS", "TOTAL"),
      );
      const value = 10;
      const column = createOrdersTotalDatasetColumn();
      const row = [{ col: column, value }];

      const drill = queryDrillThru(
        drillType,
        queryWithBreakout,
        stageIndex,
        column,
        value,
        row,
      );

      expect(drill).toBeNull();
    });

    it("should not allow to drill with a native query", () => {
      const query = createQuery({
        query: {
          type: "native",
          database: SAMPLE_DB_ID,
          native: { query: "SELECT * FROM ORDERS" },
        },
      });
      const column = createOrdersIdDatasetColumn({
        id: undefined,
        field_ref: ["field", "ID", { "base-type": "type/Integer" }],
      });

      const drill = queryDrillThru(drillType, query, stageIndex, column);

      expect(drill).toBeNull();
    });

    it("should not allow to drill when clicked on a column", () => {
      const drill = queryDrillThru(
        drillType,
        defaultQuery,
        stageIndex,
        defaultColumn,
      );

      expect(drill).toBeNull();
    });

    // eslint-disable-next-line jest/no-disabled-tests
    it.skip("should not allow to drill when clicked on a null value (metabase#36130)", () => {
      const value = null;
      const row = [{ col: defaultColumn, value }];
      const drill = queryDrillThru(
        drillType,
        defaultQuery,
        stageIndex,
        defaultColumn,
        value,
        row,
      );

      expect(drill).toBeNull();
    });

    it("should not allow to drill when the column is a FK", () => {
      const column = createOrdersProductIdDatasetColumn();
      const value = 10;
      const row = [{ col: column, value }];
      const drill = queryDrillThru(
        drillType,
        defaultQuery,
        stageIndex,
        column,
        value,
        row,
      );

      expect(drill).toBeNull();
    });

    it("should not allow to drill when clicked on a PK value when there are multiple PKs", () => {
      const metadata = createMockMetadata({
        databases: [
          createSampleDatabase({
            tables: [
              createOrdersTable({
                fields: [
                  createOrdersIdField(),
                  createOrdersProductIdField({ semantic_type: "type/PK" }),
                  createOrdersTotalField(),
                ],
              }),
            ],
          }),
        ],
      });
      const query = createQuery({ metadata });
      const value = 10;
      const row = [{ col: defaultColumn, value }];

      const drill = queryDrillThru(
        drillType,
        query,
        stageIndex,
        defaultColumn,
        value,
        row,
      );

      expect(drill).toBeNull();
    });

    it("should not allow to drill with a non-editable query", () => {
      const metadata = createMockMetadata({
        databases: [createSampleDatabase({ tables: [] })],
      });
      const query = createQuery({ metadata });
      const drill = queryDrillThru(drillType, query, stageIndex, defaultColumn);
      expect(drill).toBeNull();
    });
  });

  describe("drillThru", () => {
    it("should drill with a PK column", () => {
      const value = 10;
      const row = [{ col: defaultColumn, value }];
      const { drill } = findDrillThru(
        drillType,
        defaultQuery,
        stageIndex,
        defaultColumn,
        value,
        row,
      );

      const newQuery = Lib.drillThru(defaultQuery, stageIndex, drill);

      expect(newQuery).toBeDefined();
    });
  });
});
