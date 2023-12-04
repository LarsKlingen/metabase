import {
  createOrdersCreatedAtDatasetColumn,
  createOrdersIdField,
  createOrdersTable,
  createOrdersTotalDatasetColumn,
  createOrdersTotalField,
  createSampleDatabase,
} from "metabase-types/api/mocks/presets";
import { createMockMetadata } from "__support__/metadata";
import * as Lib from "metabase-lib";
import {
  createColumnClickObject,
  createQuery,
  createRawCellClickObject,
  findDrillThru,
  queryDrillThru,
} from "metabase-lib/test-helpers";
import {
  createNotEditableQuery,
  createOrdersStructuredDatasetColumn,
  createOrdersStructuredField,
} from "./drills-common";

describe("drill-thru/summarize-column-by-time", () => {
  const drillType = "drill-thru/summarize-column-by-time";
  const defaultQuery = createQuery();
  const stageIndex = 0;
  const defaultColumn = createOrdersTotalDatasetColumn();

  it("should drill thru a summable column", () => {
    const clickObject = createColumnClickObject({
      column: defaultColumn,
    });
    const { drill } = findDrillThru(
      defaultQuery,
      stageIndex,
      clickObject,
      drillType,
    );
    const newQuery = Lib.drillThru(defaultQuery, stageIndex, drill);
    expect(Lib.aggregations(newQuery, stageIndex)).toHaveLength(1);
    expect(Lib.breakouts(newQuery, stageIndex)).toHaveLength(1);
  });

  it("should not drill thru a non-summable column", () => {
    const clickObject = createColumnClickObject({
      column: createOrdersCreatedAtDatasetColumn(),
    });
    const drill = queryDrillThru(
      defaultQuery,
      stageIndex,
      clickObject,
      drillType,
    );
    expect(drill).toBeNull();
  });

  it("should not drill thru a column header when there is no date column", () => {
    const metadata = createMockMetadata({
      databases: [
        createSampleDatabase({
          tables: [
            createOrdersTable({
              fields: [createOrdersIdField(), createOrdersTotalField()],
            }),
          ],
        }),
      ],
    });
    const query = createQuery({ metadata });
    const clickObject = createColumnClickObject({ column: defaultColumn });
    const drill = queryDrillThru(query, stageIndex, clickObject, drillType);
    expect(drill).toBeNull();
  });

  it("should not drill thru a cell", () => {
    const clickObject = createRawCellClickObject({
      column: defaultColumn,
      value: 10,
    });
    const drill = queryDrillThru(
      defaultQuery,
      stageIndex,
      clickObject,
      drillType,
    );
    expect(drill).toBeNull();
  });

  it("should not drill thru a cell with null value", () => {
    const clickObject = createRawCellClickObject({
      column: defaultColumn,
      value: null,
    });
    const drill = queryDrillThru(
      defaultQuery,
      stageIndex,
      clickObject,
      drillType,
    );
    expect(drill).toBeNull();
  });

  it("should not drill thru a Structured column", () => {
    const metadata = createMockMetadata({
      databases: [
        createSampleDatabase({
          tables: [
            createOrdersTable({
              fields: [createOrdersIdField(), createOrdersStructuredField()],
            }),
          ],
        }),
      ],
    });
    const query = createQuery({ metadata });
    const column = createOrdersStructuredDatasetColumn();
    const clickObject = createColumnClickObject({ column });
    const drill = queryDrillThru(query, stageIndex, clickObject, drillType);
    expect(drill).toBeNull();
  });

  it("should not drill thru a non-editable query", () => {
    const query = createNotEditableQuery(defaultQuery);
    const clickObject = createColumnClickObject({
      column: defaultColumn,
    });
    const drill = queryDrillThru(query, stageIndex, clickObject, drillType);
    expect(drill).toBeNull();
  });
});
