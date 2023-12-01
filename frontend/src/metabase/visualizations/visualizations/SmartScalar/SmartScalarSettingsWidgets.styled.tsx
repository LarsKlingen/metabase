import styled from "@emotion/styled";
import type { MouseEvent } from "react";
import { Menu, NumberInput } from "metabase/ui";

export const StyledMenuTarget = styled(Menu.Target)`
  width: 100%;

  .emotion-Button-label {
    width: 100%;
    height: 100%;
  }
`;

export const StyledMenuItem = styled(Menu.Item)<{
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  isSelected?: boolean;
  py?: string;
}>`
  ${({ theme, isSelected }) =>
    isSelected &&
    `
    color: ${theme.colors.brand[1]};
    background-color: ${theme.colors.brand[0]};`}
`;

export const StyledNumberInput = styled(NumberInput)`
  .emotion-Input-wrapper {
    margin-top: 0;
  }

  .emotion-Input-input {
    text-align: center;
  }
`;
