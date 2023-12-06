import type { MouseEvent } from "react";
import { useMemo, useState } from "react";
import { t } from "ttag";
import { Button, Flex, Grid, Popover, Text } from "metabase/ui";
import { Icon } from "metabase/core/components/Icon";
import IconButtonWrapper from "metabase/components/IconButtonWrapper";
import { getColumnIcon } from "metabase/common/utils/columns";
import type {
  DatePickerExtractionUnit,
  DatePickerOperator,
  DatePickerValue,
  ShortcutOption,
} from "metabase/querying/components/DatePicker";
import { DatePicker } from "metabase/querying/components/DatePicker";
import { useDateFilter } from "metabase/querying/hooks/use-date-filter";
import * as Lib from "metabase-lib";
import type { FilterPickerWidgetProps } from "../types";
import { MODAL_Z_INDEX, SECONDARY_SHORTCUTS } from "./constants";
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

  const filterName = useMemo(() => {
    return filter
      ? Lib.filterArgsDisplayName(query, stageIndex, filter)
      : undefined;
  }, [query, stageIndex, filter]);

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
    onChange(value ? getFilterClause(value) : null);
  };

  const handleToggle = (option: ShortcutOption) => {
    if (option.shortcut !== selectedOption?.shortcut) {
      handleChange(option.value);
    } else {
      handleChange(undefined);
    }
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
                onClick={() => handleToggle(option)}
              >
                {option.label}
              </Button>
            );
          })}
          <DateFilterPopover
            title={filterName}
            value={value}
            availableOperators={availableOperators}
            availableUnits={availableUnits}
            isExpanded={visibleOptions.length === 0}
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
  const handleOpen = () => setIsOpened(true);
  const handleClose = () => setIsOpened(false);

  const handleChange = (value: DatePickerValue) => {
    onChange(value);
    handleClose();
  };

  const handleClear = (event: MouseEvent) => {
    event.stopPropagation();
    onChange(undefined);
    handleClose();
  };

  return (
    <Popover opened={isOpened} zIndex={MODAL_Z_INDEX + 1} onClose={handleClose}>
      <Popover.Target>
        {isExpanded ? (
          <Button
            variant="outline"
            rightIcon={
              <IconButtonWrapper aria-label={t`Clear`} onClick={handleClear}>
                <ClearIcon name="close" size={12} />
              </IconButtonWrapper>
            }
            onClick={handleOpen}
          >
            {title}
          </Button>
        ) : (
          <Button leftIcon={<Icon name="ellipsis" />} onClick={handleOpen} />
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
