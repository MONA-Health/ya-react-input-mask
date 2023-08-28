export function setInputSelection(
  input: HTMLInputElement,
  start: number | null,
  end?: number | null
) {
  if (end === undefined) {
    end = start;
  }
  input.setSelectionRange(start, end);
}

export function getInputSelection(input: HTMLInputElement) {
  const start = input.selectionStart;
  const end = input.selectionEnd;

  return {
    start,
    end,
    length: start && end ? end - start : null,
  };
}

export function isInputFocused(input: HTMLInputElement) {
  const inputDocument = input.ownerDocument;
  return inputDocument.hasFocus() && inputDocument.activeElement === input;
}
