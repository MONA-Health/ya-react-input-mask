/* eslint no-use-before-define: ["error", { functions: false }] */
import { findLastIndex, repeat } from "./helpers";
import parseMask from "./parse-mask";

export default class MaskUtils {
  maskOptions:
    | {
        maskPlaceholder: null;
        mask: null;
        prefix: null;
        lastEditablePosition: null;
        permanents: never[];
      }
    | {
        maskPlaceholder: string;
        prefix: string;
        mask: string[];
        lastEditablePosition: number;
        permanents: number[];
      };

  constructor(options: { mask: any; maskPlaceholder: any }) {
    this.maskOptions = parseMask(options);
  }

  isCharacterAllowedAtPosition = (character: string, position: number) => {
    const { maskPlaceholder } = this.maskOptions;

    if (this.isCharacterFillingPosition(character, position)) {
      return true;
    }

    if (!maskPlaceholder) {
      return false;
    }

    return maskPlaceholder[position] === character;
  };

  isCharacterFillingPosition = (character: string, position: number) => {
    const { mask } = this.maskOptions;

    if (!mask) {
      return false;
    }

    if (!character || position >= mask.length) {
      return false;
    }

    if (!this.isPositionEditable(position)) {
      return mask[position] === character;
    }

    const charRule = mask[position];
    return new RegExp(charRule).test(character);
  };

  isPositionEditable = (position: number) => {
    const { mask, permanents } = this.maskOptions;
    if (!mask) {
      return false;
    }
    return position < mask.length && permanents.indexOf(position) === -1;
  };

  isValueEmpty = (value: string) =>
    value
      .split("")
      .every(
        (character, position) =>
          !this.isPositionEditable(position) ||
          !this.isCharacterFillingPosition(character, position),
      );

  isValueFilled = (value: string) => {
    if (this.maskOptions.lastEditablePosition === null) {
      return false;
    }
    return (
      this.getFilledLength(value) === this.maskOptions.lastEditablePosition + 1
    );
  };

  getDefaultSelectionForValue = (value: string) => {
    const filledLength = this.getFilledLength(value);
    const cursorPosition = this.getRightEditablePosition(filledLength);
    return {
      start: cursorPosition,
      end: cursorPosition,
      length: cursorPosition ? 0 : null,
    };
  };

  getFilledLength = (value: string) => {
    const characters = value.split("");
    const lastFilledIndex = findLastIndex(
      characters,
      (character: string, position: number) =>
        this.isPositionEditable(position) &&
        this.isCharacterFillingPosition(character, position),
    );
    return lastFilledIndex + 1;
  };

  getStringFillingLengthAtPosition = (string: string, position: number) => {
    const characters = string.split("");
    const insertedValue = characters.reduce(
      (value, character) =>
        this.insertCharacterAtPosition(value, character, value.length),
      repeat(" ", position),
    );

    return insertedValue.length - position;
  };

  getLeftEditablePosition = (position: number) => {
    for (let i = position; i >= 0; i--) {
      if (this.isPositionEditable(i)) {
        return i;
      }
    }
    return null;
  };

  getRightEditablePosition = (position: number | null) => {
    const { mask } = this.maskOptions;
    if (!mask) {
      return null;
    }
    if (!position) {
      return null;
    }
    for (let i = position; i < mask.length; i++) {
      if (this.isPositionEditable(i)) {
        return i;
      }
    }
    return null;
  };

  formatValue = (value: string) => {
    const { maskPlaceholder, mask } = this.maskOptions;

    if (!maskPlaceholder) {
      value = this.insertStringAtPosition("", value, 0);

      if (!mask) {
        return value;
      }

      while (
        value.length < mask.length &&
        !this.isPositionEditable(value.length)
      ) {
        value += mask[value.length];
      }

      return value;
    }

    return this.insertStringAtPosition(maskPlaceholder, value, 0);
  };

  clearRange = (value: string, start: number | null, len: number) => {
    if (!len) {
      return value;
    }
    if (!start) {
      return value;
    }

    const end = start + len;
    const { maskPlaceholder, mask } = this.maskOptions;

    if (!mask) {
      return value;
    }

    const clearedValue = value
      .split("")
      .map((character, i) => {
        const isEditable = this.isPositionEditable(i);

        if (!maskPlaceholder && i >= end && !isEditable) {
          return "";
        }
        if (i < start || i >= end) {
          return character;
        }
        if (!isEditable) {
          return mask[i];
        }
        if (maskPlaceholder) {
          return maskPlaceholder[i];
        }
        return "";
      })
      .join("");

    return this.formatValue(clearedValue);
  };

  insertCharacterAtPosition = (
    value: string | any[],
    character: string,
    position: number,
  ): any => {
    const { mask, maskPlaceholder } = this.maskOptions;
    if (!mask) {
      return value;
    }
    if (position >= mask.length) {
      return value;
    }

    const isAllowed = this.isCharacterAllowedAtPosition(character, position);
    const isEditable = this.isPositionEditable(position);
    const nextEditablePosition = this.getRightEditablePosition(position);
    const isNextPlaceholder =
      maskPlaceholder && nextEditablePosition
        ? character === maskPlaceholder[nextEditablePosition]
        : null;
    const valueBefore = value.slice(0, position);

    if (isAllowed || !isEditable) {
      const insertedCharacter = isAllowed ? character : mask[position];
      value = valueBefore + insertedCharacter;
    }

    if (!isAllowed && !isEditable && !isNextPlaceholder) {
      value = this.insertCharacterAtPosition(value, character, position + 1);
    }

    return value;
  };

  insertStringAtPosition = (
    value: string,
    string: string,
    position: number | null,
  ) => {
    const { mask, maskPlaceholder } = this.maskOptions;
    if (!mask) {
      return value;
    }
    if (!position) {
      return value;
    }
    if (!string || position >= mask.length) {
      return value;
    }

    const characters = string.split("");
    const isFixedLength = this.isValueFilled(value) || !!maskPlaceholder;
    const valueAfter = value.slice(position);

    value = characters.reduce(
      (v, character) => this.insertCharacterAtPosition(v, character, v.length),
      value.slice(0, position),
    );

    if (isFixedLength) {
      value += valueAfter.slice(value.length - position);
    } else if (this.isValueFilled(value)) {
      value += mask.slice(value.length).join("");
    } else {
      const editableCharactersAfter = valueAfter
        .split("")
        .filter((character, i) => this.isPositionEditable(position + i));
      value = editableCharactersAfter.reduce((v, character) => {
        const nextEditablePosition = this.getRightEditablePosition(v.length);
        if (nextEditablePosition === null) {
          return v;
        }

        if (!this.isPositionEditable(v.length)) {
          v += mask.slice(v.length, nextEditablePosition).join("");
        }

        return this.insertCharacterAtPosition(v, character, v.length);
      }, value);
    }

    return value;
  };

  processChange = (
    currentState: { value: string; selection: any },
    previousState: { value: string; selection: any },
  ) => {
    const { mask, prefix, lastEditablePosition } = this.maskOptions;
    const { value, selection } = currentState;
    const previousValue = previousState.value;
    const previousSelection = previousState.selection;
    let newValue = value;
    let enteredString = "";
    let formattedEnteredStringLength = 0;
    let removedLength = 0;
    let cursorPosition: number | null = Math.min(
      previousSelection.start,
      selection.start,
    );

    if (selection.end > previousSelection.start) {
      enteredString = newValue.slice(previousSelection.start, selection.end);
      formattedEnteredStringLength = this.getStringFillingLengthAtPosition(
        enteredString,
        cursorPosition,
      );
      if (!formattedEnteredStringLength) {
        removedLength = 0;
      } else {
        removedLength = previousSelection.length;
      }
    } else if (newValue.length < previousValue.length) {
      removedLength = previousValue.length - newValue.length;
    }

    newValue = previousValue;

    if (removedLength) {
      if (removedLength === 1 && !previousSelection.length) {
        const deleteFromRight = previousSelection.start === selection.start;
        cursorPosition = deleteFromRight
          ? this.getRightEditablePosition(selection.start)
          : this.getLeftEditablePosition(selection.start);
      }
      newValue = this.clearRange(newValue, cursorPosition, removedLength);
    }

    newValue = this.insertStringAtPosition(
      newValue,
      enteredString,
      cursorPosition,
    );

    newValue = this.formatValue(newValue);

    if (!cursorPosition || !mask) {
      return {
        value: newValue,
        enteredString,
        selection: { start: cursorPosition, end: cursorPosition },
      };
    }

    cursorPosition += formattedEnteredStringLength;
    if (cursorPosition >= mask.length) {
      cursorPosition = mask.length;
    } else if (
      cursorPosition < prefix.length &&
      !formattedEnteredStringLength
    ) {
      cursorPosition = prefix.length;
    } else if (
      cursorPosition >= prefix.length &&
      cursorPosition < lastEditablePosition &&
      formattedEnteredStringLength
    ) {
      cursorPosition = this.getRightEditablePosition(cursorPosition);
    }

    return {
      value: newValue,
      enteredString,
      selection: { start: cursorPosition, end: cursorPosition },
    };
  };
}
