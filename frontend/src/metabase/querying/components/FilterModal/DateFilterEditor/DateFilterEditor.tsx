import { useCallback, useMemo, useState } from "react";
import { Button, Flex, Grid, Popover, Text } from "metabase/ui";
import { Icon } from "metabase/core/components/Icon";
import { getColumnIcon } from "metabase/common/utils/columns";
import type {
  DatePickerExtractionUnit,
  DatePickerOperator,
  DatePickerValue,
} from "metabase/querying/components/DatePicker";
import { DatePicker } from "metabase/querying/components/DatePicker";
import { useDateFilter } from "metabase/querying/hooks/use-date-filter";
import * as Lib from "metabase-lib";
import type { FilterPickerWidgetProps } from "../types";
import { SECONDARY_SHORTCUTS } from "./constants";
import { getOptionsInfo } from "./utils";
import { ClearIcon } from "./DateFilterEditor.styled";

export function DateFilterEditor({
  query,
  stageIndex,
  column,
  filter,
  onChange,
}: FilterPickerWidgetProps) {
  const columnInfo = useMemo(
    () => Lib.displayInfo(query, stageIndex, column),
    [query, stageIndex, column],
  );

  const columnIcon = useMemo(() => {
    return getColumnIcon(column);
  }, [column]);

  const { value, availableOperators, availableUnits, getFilterClause } =
    useDateFilter({
      query,
      stageIndex,
      column,
      filter,
    });

  const { visibleOptions, selectedOption } = useMemo(
    () => getOptionsInfo(value),
    [value],
  );

  const handleChange = (value: DatePickerValue | undefined) => {
    onChange(value ? getFilterClause(value) : undefined);
  };

  return (
    <Grid grow>
      <Grid.Col span="auto">
        <Flex h="100%" align="center" gap="sm">
          <Icon name={columnIcon} />
          <Text color="text.2" weight="bold">
            {columnInfo.displayName}
          </Text>
        </Flex>
      </Grid.Col>
      <Grid.Col span={4}>
        <Flex gap="0.5rem">
          {visibleOptions.map(option => {
            const isSelected = option.shortcut === selectedOption?.shortcut;
            return (
              <Button
                key={option.shortcut}
                variant={isSelected ? "outline" : "default"}
                aria-selected={isSelected}
                onClick={() => handleChange(option.value)}
              >
                {option.label}
              </Button>
            );
          })}
          <DateFilterPopover
            title=""
            value={value}
            availableOperators={availableOperators}
            availableUnits={availableUnits}
            isExpanded
            onChange={handleChange}
          />
        </Flex>
      </Grid.Col>
    </Grid>
  );
}

interface DateFilterPopoverProps {
  title: string | undefined;
  value: DatePickerValue | undefined;
  availableOperators: ReadonlyArray<DatePickerOperator>;
  availableUnits: ReadonlyArray<DatePickerExtractionUnit>;
  isExpanded: boolean;
  onChange: (value: DatePickerValue | undefined) => void;
}

function DateFilterPopover({
  title,
  value,
  availableOperators,
  availableUnits,
  isExpanded,
  onChange,
}: DateFilterPopoverProps) {
  const [isOpened, setIsOpened] = useState(false);

  const handleChange = useCallback(
    (value: DatePickerValue) => {
      onChange(value);
      setIsOpened(false);
    },
    [onChange],
  );

  return (
    <Popover opened={isOpened} onClose={() => setIsOpened(false)}>
      <Popover.Target>
        {isExpanded ? (
          <Button
            variant="outline"
            rightIcon={
              <ClearIcon
                name="close"
                size={12}
                onClick={() => setIsOpened(true)}
              />
            }
          >
            {title}
          </Button>
        ) : (
          <Button
            leftIcon={<Icon name="ellipsis" />}
            onClick={() => setIsOpened(true)}
          />
        )}
      </Popover.Target>
      <Popover.Dropdown>
        <DatePicker
          value={value}
          availableOperators={availableOperators}
          availableShortcuts={isExpanded ? undefined : SECONDARY_SHORTCUTS}
          availableUnits={availableUnits}
          canUseRelativeOffsets
          onChange={handleChange}
        />
      </Popover.Dropdown>
    </Popover>
  );
}
