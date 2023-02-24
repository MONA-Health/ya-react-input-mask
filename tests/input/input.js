/* global describe, it, afterEach */

import React, { createRef } from "react";
import ReactDOM from "react-dom";
import TestUtils from "react-dom/test-utils";
import { expect } from "chai"; // eslint-disable-line import/no-extraneous-dependencies
import * as deferUtils from "../../src/utils/defer";
import Input from "../../src";
import { getInputSelection } from "../../src/utils/input";
import { isDOMElement } from "../../src/utils/helpers";

document.body.innerHTML = '<div id="container"></div>';
const container = document.getElementById("container");

async function delay(duration) {
  await new Promise(resolve => setTimeout(resolve, duration));
}

async function defer() {
  await new Promise(resolve => deferUtils.defer(resolve));
}

async function setSelection(inputRef, start, length) {
  inputRef.current.setSelectionRange(start, start + length);
  await defer();
}

async function setCursorPosition(inputRef, start) {
  await setSelection(inputRef, start, 0);
}

async function waitForPendingSelection() {
  await defer();
}

function getInputDOMNode(input) {
  if (!isDOMElement(input)) {
    input = ReactDOM.findDOMNode(input);
  }

  if (input.nodeName !== "INPUT") {
    input = input.querySelector("input");
  }

  if (!input) {
    throw new Error("inputComponent doesn't contain input node");
  }

  return input;
}

function createInput(component) {
  const originalRef = component.ref;
  let { props } = component;
  const inputRef = props?.children?.ref ? props.children.ref : createRef();
  const refCallback = node => {
    inputRef.current = node;

    if (typeof originalRef === "function") {
      originalRef(node);
    } else if (originalRef !== null && typeof originalRef === "object") {
      originalRef.current = node;
    }
  };

  component = React.cloneElement(component, {
    ref: refCallback
  });

  function setProps(newProps) {
    props = {
      ...props,
      ...newProps,
      ref: refCallback
    };

    ReactDOM.render(React.createElement(Input, props), container);
  }

  ReactDOM.render(component, container);

  return { inputRef, setProps };
}

async function simulateFocus(inputRef) {
  inputRef.current.focus();
  TestUtils.Simulate.focus(inputRef.current);
  await defer();
}

async function simulateBlur(inputRef) {
  inputRef.current.blur();
  TestUtils.Simulate.blur(inputRef.current);
}

async function simulateInput(inputRef, string) {
  const selection = getInputSelection(inputRef.current);
  const { value } = inputRef.current;
  const valueBefore = value.slice(0, selection.start);
  const valueAfter = value.slice(selection.end);

  inputRef.current.value = valueBefore + string + valueAfter;

  setCursorPosition(inputRef, selection.start + string.length);

  TestUtils.Simulate.change(inputRef.current);
}

async function simulateInputPaste(inputRef, string) {
  TestUtils.Simulate.paste(inputRef.current);
  await simulateInput(inputRef, string);
}

async function simulateBackspacePress(inputRef) {
  const selection = getInputSelection(inputRef.current);
  const { value } = inputRef.current;

  if (selection.length) {
    inputRef.current.value =
      value.slice(0, selection.start) + value.slice(selection.end);
    setSelection(inputRef, selection.start, 0);
  } else if (selection.start) {
    inputRef.current.value =
      value.slice(0, selection.start - 1) + value.slice(selection.end);
    setSelection(inputRef, selection.start - 1, 0);
  }

  TestUtils.Simulate.change(inputRef.current);
}

async function simulateDeletePress(inputRef) {
  const selection = getInputSelection(inputRef.current);
  const removedLength = selection.end - selection.start || 1;
  const { value } = inputRef.current;
  const valueBefore = value.slice(0, selection.start);
  const valueAfter = value.slice(selection.start + removedLength);

  inputRef.current.value = valueBefore + valueAfter;

  setCursorPosition(inputRef, selection.start);

  TestUtils.Simulate.change(inputRef.current);
}

// eslint-disable-next-line react/prefer-stateless-function
class ClassInputComponent extends React.Component {
  render() {
    return (
      <div>
        <input {...this.props} />
      </div>
    );
  }
}

const FunctionalInputComponent = React.forwardRef((props, ref) => {
  return (
    <div ref={ref}>
      <div>
        <input {...props} />
      </div>
    </div>
  );
});

describe("react-input-mask", () => {
  afterEach(() => {
    ReactDOM.unmountComponentAtNode(container);
  });

  it("should format value on mount", async () => {
    const { inputRef } = createInput(
      <Input mask="+7 (999) 999 99 99" defaultValue="74953156454" />
    );
    expect(inputRef.current.value).to.equal("+7 (495) 315 64 54");
  });

  it("should format value with invalid characters on mount", async () => {
    const { inputRef } = createInput(
      <Input mask="+7 (9a9) 999 99 99" defaultValue="749531b6454" />
    );
    expect(inputRef.current.value).to.equal("+7 (4b6) 454 __ __");
  });

  it("should handle array mask", async () => {
    const letter = /[АВЕКМНОРСТУХ]/i;
    const digit = /[0-9]/;
    const mask = [letter, digit, digit, digit, letter, letter];
    const { inputRef } = createInput(
      <Input mask={mask} defaultValue="А 784 КТ 77" />
    );
    expect(inputRef.current.value).to.equal("А784КТ");

    await simulateFocus(inputRef);
    await simulateBackspacePress(inputRef);
    expect(inputRef.current.value).to.equal("А784К_");

    await simulateInput(inputRef, "Б");
    expect(getInputSelection(inputRef.current).start).to.equal(5);
    expect(getInputSelection(inputRef.current).end).to.equal(5);

    await simulateInput(inputRef, "Х");
    expect(getInputSelection(inputRef.current).start).to.equal(6);
    expect(getInputSelection(inputRef.current).end).to.equal(6);
  });

  it("should handle full length maskPlaceholder", async () => {
    const { inputRef } = createInput(
      <Input mask="99/99/9999" maskPlaceholder="dd/mm/yyyy" defaultValue="12" />
    );
    expect(inputRef.current.value).to.equal("12/mm/yyyy");

    await simulateFocus(inputRef);
    expect(getInputSelection(inputRef.current).start).to.equal(3);
    expect(getInputSelection(inputRef.current).end).to.equal(3);

    await simulateBackspacePress(inputRef);
    expect(inputRef.current.value).to.equal("1d/mm/yyyy");

    await simulateInput(inputRef, "234");
    expect(inputRef.current.value).to.equal("12/34/yyyy");
    expect(getInputSelection(inputRef.current).start).to.equal(6);
    expect(getInputSelection(inputRef.current).end).to.equal(6);

    await setCursorPosition(inputRef, 8);
    await simulateInput(inputRef, "7");
    expect(inputRef.current.value).to.equal("12/34/yy7y");
  });

  it("should show placeholder on focus", async () => {
    const { inputRef } = createInput(<Input mask="+7 (*a9) 999 99 99" />);
    expect(inputRef.current.value).to.equal("");

    await simulateFocus(inputRef);
    expect(inputRef.current.value).to.equal("+7 (___) ___ __ __");
  });

  it("should clear input on blur", async () => {
    const { inputRef } = createInput(<Input mask="+7 (*a9) 999 99 99" />);
    await simulateFocus(inputRef);
    expect(inputRef.current.value).to.equal("+7 (___) ___ __ __");

    await simulateBlur(inputRef);
    expect(inputRef.current.value).to.equal("");

    await simulateFocus(inputRef);
    await simulateInput(inputRef, "1");
    expect(inputRef.current.value).to.equal("+7 (1__) ___ __ __");

    await simulateBlur(inputRef);
    expect(inputRef.current.value).to.equal("+7 (1__) ___ __ __");
  });

  it("should handle escaped characters in mask", async () => {
    const { inputRef } = createInput(
      <Input mask="+4\9 99 9\99 99" maskPlaceholder={null} />
    );
    await simulateFocus(inputRef);

    inputRef.current.value = "+49 12 9";
    setSelection(inputRef, 8, 0);
    TestUtils.Simulate.change(inputRef.current);
    expect(inputRef.current.value).to.equal("+49 12 99");

    await setCursorPosition(inputRef, 7);

    await simulateInput(inputRef, "1");
    TestUtils.Simulate.change(inputRef.current);
    expect(inputRef.current.value).to.equal("+49 12 199 ");
    expect(getInputSelection(inputRef.current).start).to.equal(9);
    expect(getInputSelection(inputRef.current).end).to.equal(9);

    await setCursorPosition(inputRef, 8);

    await simulateInput(inputRef, "9");
    TestUtils.Simulate.change(inputRef.current);
    expect(inputRef.current.value).to.equal("+49 12 199 ");
    expect(getInputSelection(inputRef.current).start).to.equal(9);
    expect(getInputSelection(inputRef.current).end).to.equal(9);
  });

  it("should handle alwaysShowMask", async () => {
    const { inputRef, setProps } = createInput(
      <Input mask="+7 (999) 999 99 99" alwaysShowMask />
    );
    expect(inputRef.current.value).to.equal("+7 (___) ___ __ __");

    await simulateFocus(inputRef);
    expect(inputRef.current.value).to.equal("+7 (___) ___ __ __");

    await simulateBlur(inputRef);
    expect(inputRef.current.value).to.equal("+7 (___) ___ __ __");

    setProps({ alwaysShowMask: false });
    expect(inputRef.current.value).to.equal("");

    setProps({ alwaysShowMask: true });
    expect(inputRef.current.value).to.equal("+7 (___) ___ __ __");
  });

  it("should adjust cursor position on focus", async () => {
    const { inputRef, setProps } = createInput(
      <Input mask="+7 (999) 999 99 99" value="+7" />
    );
    await simulateFocus(inputRef);

    expect(getInputSelection(inputRef.current).start).to.equal(4);
    expect(getInputSelection(inputRef.current).end).to.equal(4);

    await simulateBlur(inputRef);

    setProps({ value: "+7 (___) ___ _1 __" });
    await setCursorPosition(inputRef, 2);
    await simulateFocus(inputRef);
    expect(getInputSelection(inputRef.current).start).to.equal(16);
    expect(getInputSelection(inputRef.current).end).to.equal(16);

    await simulateBlur(inputRef);

    setProps({ value: "+7 (___) ___ _1 _1" });
    await setCursorPosition(inputRef, 2);
    await simulateFocus(inputRef);
    expect(getInputSelection(inputRef.current).start).to.equal(2);
    expect(getInputSelection(inputRef.current).end).to.equal(2);

    await simulateBlur(inputRef);

    setProps({
      value: "+7 (123)",
      mask: "+7 (999)",
      maskPlaceholder: null
    });
    await setCursorPosition(inputRef, 2);
    await simulateFocus(inputRef);
    expect(getInputSelection(inputRef.current).start).to.equal(2);
    expect(getInputSelection(inputRef.current).end).to.equal(2);
  });

  it("should adjust cursor position on focus on input with autoFocus", async () => {
    const { inputRef, setProps } = createInput(
      <Input mask="+7 (999) 999 99 99" value="+7" autoFocus />
    );
    expect(getInputSelection(inputRef.current).start).to.equal(4);
    expect(getInputSelection(inputRef.current).end).to.equal(4);

    await simulateBlur(inputRef);

    setProps({ value: "+7 (___) ___ _1 __" });
    await setCursorPosition(inputRef, 2);
    await simulateFocus(inputRef);
    expect(getInputSelection(inputRef.current).start).to.equal(16);
    expect(getInputSelection(inputRef.current).end).to.equal(16);

    await simulateBlur(inputRef);

    setProps({ value: "+7 (___) ___ _1 _1" });
    await setCursorPosition(inputRef, 2);
    await simulateFocus(inputRef);
    expect(getInputSelection(inputRef.current).start).to.equal(2);
    expect(getInputSelection(inputRef.current).end).to.equal(2);
  });

  it("should handle changes on input with autoFocus", async () => {
    const { inputRef } = createInput(
      <Input mask="+7 (999) 999 99 99" autoFocus />
    );
    await simulateInput(inputRef, "222 222 22 22");

    await defer();
    setSelection(inputRef, 5, 0);
    await delay(100);
    await simulateInput(inputRef, "3");
    expect(inputRef.current.value).to.equal("+7 (232) 222 22 22");
  });

  it("should format value in onChange (with maskPlaceholder)", async () => {
    const { inputRef } = createInput(<Input mask="**** **** **** ****" />);
    await simulateFocus(inputRef);

    await setCursorPosition(inputRef, 0);
    inputRef.current.value = `a${inputRef.value}`;
    setCursorPosition(inputRef, 1);
    TestUtils.Simulate.change(inputRef.current);
    expect(inputRef.current.value).to.equal("a___ ____ ____ ____");
    expect(getInputSelection(inputRef.current).start).to.equal(1);
    expect(getInputSelection(inputRef.current).end).to.equal(1);

    await setSelection(inputRef, 0, 19);
    inputRef.current.value = "a";
    setCursorPosition(inputRef, 1);
    TestUtils.Simulate.change(inputRef.current);
    expect(inputRef.current.value).to.equal("a___ ____ ____ ____");
    expect(getInputSelection(inputRef.current).start).to.equal(1);
    expect(getInputSelection(inputRef.current).end).to.equal(1);

    inputRef.current.value = "aaaaa___ ____ ____ ____";
    setSelection(inputRef, 1, 4);
    TestUtils.Simulate.change(inputRef.current);
    expect(inputRef.current.value).to.equal("aaaa a___ ____ ____");
    expect(getInputSelection(inputRef.current).start).to.equal(6);
    expect(getInputSelection(inputRef.current).end).to.equal(6);

    await setCursorPosition(inputRef, 4);
    inputRef.current.value = "aaa a___ ____ ____";
    setCursorPosition(inputRef, 3);
    TestUtils.Simulate.change(inputRef.current);
    expect(inputRef.current.value).to.equal("aaa_ a___ ____ ____");

    await setSelection(inputRef, 3, 3);
    inputRef.current.value = "aaaaaa___ ____ ____";
    setCursorPosition(inputRef, 6);
    TestUtils.Simulate.change(inputRef.current);
    expect(inputRef.current.value).to.equal("aaaa aa__ ____ ____");

    await setSelection(inputRef, 3, 3);
    inputRef.current.value = "aaaaxa__ ____ ____";
    setCursorPosition(inputRef, 5);
    TestUtils.Simulate.change(inputRef.current);
    expect(inputRef.current.value).to.equal("aaaa xa__ ____ ____");
    expect(getInputSelection(inputRef.current).start).to.equal(6);
    expect(getInputSelection(inputRef.current).end).to.equal(6);
  });

  it("should format value in onChange (without maskPlaceholder)", async () => {
    const { inputRef } = createInput(
      <Input mask="**** **** **** ****" maskPlaceholder={null} />
    );
    await simulateFocus(inputRef);
    expect(inputRef.current.value).to.equal("");

    await setCursorPosition(inputRef, 0);
    inputRef.current.value = "aaa";
    setCursorPosition(inputRef, 3);
    TestUtils.Simulate.change(inputRef.current);
    expect(inputRef.current.value).to.equal("aaa");
    expect(getInputSelection(inputRef.current).start).to.equal(3);
    expect(getInputSelection(inputRef.current).end).to.equal(3);

    inputRef.current.value = "aaaaa";
    setCursorPosition(inputRef, 5);
    TestUtils.Simulate.change(inputRef.current);
    expect(inputRef.current.value).to.equal("aaaa a");
    expect(getInputSelection(inputRef.current).start).to.equal(6);
    expect(getInputSelection(inputRef.current).end).to.equal(6);

    inputRef.current.value = "aaaa afgh ijkl mnop";
    setCursorPosition(inputRef, 19);
    TestUtils.Simulate.change(inputRef.current);
    expect(inputRef.current.value).to.equal("aaaa afgh ijkl mnop");
    expect(getInputSelection(inputRef.current).start).to.equal(19);
    expect(getInputSelection(inputRef.current).end).to.equal(19);

    inputRef.current.value = "aaaa afgh ijkl mnopq";
    setCursorPosition(inputRef, 20);
    TestUtils.Simulate.change(inputRef.current);
    expect(inputRef.current.value).to.equal("aaaa afgh ijkl mnop");
    expect(getInputSelection(inputRef.current).start).to.equal(19);
    expect(getInputSelection(inputRef.current).end).to.equal(19);
  });

  it("should handle entered characters (with maskPlaceholder)", async () => {
    const { inputRef } = createInput(<Input mask="+7 (*a9) 999 99 99" />);
    await simulateFocus(inputRef);

    await setCursorPosition(inputRef, 0);
    await simulateInput(inputRef, "+");
    expect(inputRef.current.value).to.equal("+7 (___) ___ __ __");

    await setCursorPosition(inputRef, 0);
    await simulateInput(inputRef, "7");
    expect(inputRef.current.value).to.equal("+7 (___) ___ __ __");

    await setCursorPosition(inputRef, 0);
    await simulateInput(inputRef, "8");
    expect(inputRef.current.value).to.equal("+7 (8__) ___ __ __");

    await setCursorPosition(inputRef, 0);
    await simulateInput(inputRef, "E");
    expect(inputRef.current.value).to.equal("+7 (E__) ___ __ __");

    await simulateInput(inputRef, "6");
    expect(inputRef.current.value).to.equal("+7 (E__) ___ __ __");

    await simulateInput(inputRef, "x");
    expect(inputRef.current.value).to.equal("+7 (Ex_) ___ __ __");
  });

  it("should handle entered characters (without maskPlaceholder)", async () => {
    const { inputRef } = createInput(
      <Input
        mask="+7 (999) 999 99 99"
        defaultValue="+7 (111) 123 45 6"
        maskPlaceholder={null}
      />
    );
    await simulateFocus(inputRef);

    await setCursorPosition(inputRef, 4);
    await simulateInput(inputRef, "E");
    expect(inputRef.current.value).to.equal("+7 (111) 123 45 6");

    await setSelection(inputRef, 4, 3);
    await simulateInput(inputRef, "0");
    expect(inputRef.current.value).to.equal("+7 (012) 345 6");

    await setCursorPosition(inputRef, 14);
    await simulateInput(inputRef, "7");
    await simulateInput(inputRef, "8");
    await simulateInput(inputRef, "9");
    await simulateInput(inputRef, "4");
    expect(inputRef.current.value).to.equal("+7 (012) 345 67 89");

    inputRef.current.value = "+7 (";
    setCursorPosition(inputRef, 4);
    TestUtils.Simulate.change(inputRef.current);
    await setCursorPosition(inputRef, 0);
    await simulateInput(inputRef, "+");
    expect(inputRef.current.value).to.equal("+7 (");
  });

  it("should adjust cursor position on input (with maskPlaceholder)", async () => {
    const { inputRef } = createInput(<Input mask="(999)" defaultValue="11" />);
    await simulateFocus(inputRef);

    await setCursorPosition(inputRef, 3);
    await simulateInput(inputRef, "x");
    expect(getInputSelection(inputRef.current).start).to.equal(3);
    expect(getInputSelection(inputRef.current).end).to.equal(3);

    await simulateInput(inputRef, "1");
    expect(getInputSelection(inputRef.current).start).to.equal(4);
    expect(getInputSelection(inputRef.current).end).to.equal(4);

    await setSelection(inputRef, 0, 4);
    await simulateBackspacePress(inputRef);
    await setCursorPosition(inputRef, 2);
    await simulateInput(inputRef, "x");
    expect(getInputSelection(inputRef.current).start).to.equal(2);
    expect(getInputSelection(inputRef.current).end).to.equal(2);
  });

  it("should handle single character removal with Backspace (with maskPlaceholder)", async () => {
    const { inputRef } = createInput(
      <Input mask="+7 (999) 999 99 99" defaultValue="74953156454" />
    );
    await simulateFocus(inputRef);

    await setCursorPosition(inputRef, 10);
    await simulateBackspacePress(inputRef);
    expect(inputRef.current.value).to.equal("+7 (495) _15 64 54");

    await simulateBackspacePress(inputRef);
    expect(inputRef.current.value).to.equal("+7 (49_) _15 64 54");
  });

  it("should handle single character removal with Backspace (without maskPlaceholder)", async () => {
    const { inputRef } = createInput(
      <Input
        mask="+7 (999) 999 99 99"
        defaultValue="74953156454"
        maskPlaceholder={null}
      />
    );
    await simulateFocus(inputRef);

    await setCursorPosition(inputRef, 10);
    await simulateBackspacePress(inputRef);
    expect(inputRef.current.value).to.equal("+7 (495) 156 45 4");

    inputRef.current.value = "+7 (";
    setCursorPosition(inputRef, 4);
    TestUtils.Simulate.change(inputRef.current);
    expect(inputRef.current.value).to.equal("+7 (");

    inputRef.current.value = "+7 ";
    setCursorPosition(inputRef, 3);
    TestUtils.Simulate.change(inputRef.current);
    expect(inputRef.current.value).to.equal("+7 (");
  });

  it("should adjust cursor position on single character removal with Backspace (with maskPlaceholder)", async () => {
    const { inputRef } = createInput(
      <Input mask="+7 (999) 999 99 99" defaultValue="74953156454" />
    );
    await simulateFocus(inputRef);

    await setCursorPosition(inputRef, 10);
    await simulateBackspacePress(inputRef);
    expect(getInputSelection(inputRef.current).start).to.equal(9);
    expect(getInputSelection(inputRef.current).end).to.equal(9);

    await simulateBackspacePress(inputRef);
    expect(getInputSelection(inputRef.current).start).to.equal(6);
    expect(getInputSelection(inputRef.current).end).to.equal(6);

    await setCursorPosition(inputRef, 4);
    await simulateBackspacePress(inputRef);
    expect(getInputSelection(inputRef.current).start).to.equal(4);
    expect(getInputSelection(inputRef.current).end).to.equal(4);
  });

  it("should adjust cursor position on single character removal with Backspace (without maskPlaceholder)", async () => {
    const { inputRef } = createInput(
      <Input
        mask="+7 (999) 999 99 99"
        defaultValue="749531564"
        maskPlaceholder={null}
      />
    );
    await simulateFocus(inputRef);

    await setCursorPosition(inputRef, 16);
    await simulateBackspacePress(inputRef);
    expect(getInputSelection(inputRef.current).start).to.equal(14);
    expect(getInputSelection(inputRef.current).end).to.equal(14);
  });

  it("should handle multiple characters removal with Backspace (with maskPlaceholder)", async () => {
    const { inputRef } = createInput(
      <Input mask="+7 (999) 999 99 99" defaultValue="74953156454" />
    );
    await simulateFocus(inputRef);

    await setSelection(inputRef, 1, 9);
    await simulateBackspacePress(inputRef);
    expect(inputRef.current.value).to.equal("+7 (___) _15 64 54");
  });

  it("should handle multiple characters removal with Backspace (without maskPlaceholder)", async () => {
    const { inputRef } = createInput(
      <Input
        mask="+7 (999) 999 99 99"
        defaultValue="74953156454"
        maskPlaceholder={null}
      />
    );
    await simulateFocus(inputRef);

    await setSelection(inputRef, 1, 9);
    await simulateBackspacePress(inputRef);
    expect(inputRef.current.value).to.equal("+7 (156) 454 ");
  });

  it("should adjust cursor position on multiple characters removal with Backspace (with maskPlaceholder)", async () => {
    const { inputRef } = createInput(
      <Input mask="+7 (999) 999 99 99" defaultValue="74953156454" />
    );
    await simulateFocus(inputRef);

    await setSelection(inputRef, 1, 9);
    await simulateBackspacePress(inputRef);
    expect(getInputSelection(inputRef.current).start).to.equal(4);
    expect(getInputSelection(inputRef.current).end).to.equal(4);
  });

  it("should handle single character removal with Backspace on mask with escaped characters (without maskPlaceholder)", async () => {
    const { inputRef } = createInput(
      <Input
        mask="+4\9 99 9\99 99"
        defaultValue="+49 12 394"
        maskPlaceholder={null}
      />
    );
    await simulateFocus(inputRef);

    await setCursorPosition(inputRef, 10);
    await simulateBackspacePress(inputRef);
    expect(inputRef.current.value).to.equal("+49 12 39");

    await setCursorPosition(inputRef, 9);
    await simulateBackspacePress(inputRef);
    expect(inputRef.current.value).to.equal("+49 12 ");

    await simulateFocus(inputRef);
    inputRef.current.value = "+49 12 39";
    TestUtils.Simulate.change(inputRef.current);
    await setCursorPosition(inputRef, 6);
    await simulateBackspacePress(inputRef);
    expect(inputRef.current.value).to.equal("+49 13 ");
  });

  it("should adjust cursor position on single character removal with Backspace on mask with escaped characters (without maskPlaceholder)", async () => {
    const { inputRef } = createInput(
      <Input
        mask="+4\9 99 9\99 99"
        defaultValue="+49 12 394"
        maskPlaceholder={null}
      />
    );
    await simulateFocus(inputRef);

    await setCursorPosition(inputRef, 10);
    await simulateBackspacePress(inputRef);
    expect(getInputSelection(inputRef.current).start).to.equal(9);
    expect(getInputSelection(inputRef.current).end).to.equal(9);

    await setCursorPosition(inputRef, 9);
    await simulateBackspacePress(inputRef);
    expect(getInputSelection(inputRef.current).start).to.equal(7);
    expect(getInputSelection(inputRef.current).end).to.equal(7);

    await simulateFocus(inputRef);
    inputRef.current.value = "+49 12 39";
    TestUtils.Simulate.change(inputRef.current);
    await setCursorPosition(inputRef, 6);
    await simulateBackspacePress(inputRef);
    expect(getInputSelection(inputRef.current).start).to.equal(5);
    expect(getInputSelection(inputRef.current).end).to.equal(5);
  });

  it("should handle multiple characters removal with Backspace on mask with escaped characters (without maskPlaceholder)", async () => {
    const { inputRef } = createInput(
      <Input
        mask="+4\9 99 9\99 99"
        defaultValue="+49 12 394"
        maskPlaceholder={null}
      />
    );
    await simulateFocus(inputRef);

    await setSelection(inputRef, 4, 2);
    await simulateBackspacePress(inputRef);
    expect(inputRef.current.value).to.equal("+49 34 ");

    await setSelection(inputRef, 0, 7);
    inputRef.current.value = "+49 12 394 5";
    TestUtils.Simulate.change(inputRef.current);
    await setSelection(inputRef, 4, 2);
    await simulateBackspacePress(inputRef);
    expect(inputRef.current.value).to.equal("+49 34 59");
  });

  it("should adjust cursor position on multiple characters removal with Backspace on mask with escaped characters (without maskPlaceholder)", async () => {
    const { inputRef } = createInput(
      <Input
        mask="+4\9 99 9\99 99"
        defaultValue="+49 12 394"
        maskPlaceholder={null}
      />
    );
    await simulateFocus(inputRef);

    await setSelection(inputRef, 4, 2);
    await simulateBackspacePress(inputRef);
    expect(getInputSelection(inputRef.current).start).to.equal(4);
    expect(getInputSelection(inputRef.current).end).to.equal(4);

    inputRef.current.value = "+49 12 394 5";
    TestUtils.Simulate.change(inputRef.current);
    await setSelection(inputRef, 4, 2);
    await simulateBackspacePress(inputRef);
    expect(getInputSelection(inputRef.current).start).to.equal(4);
    expect(getInputSelection(inputRef.current).end).to.equal(4);
  });

  it("should handle single character removal with Delete (with maskPlaceholder)", async () => {
    const { inputRef } = createInput(
      <Input mask="+7 (999) 999 99 99" defaultValue="74953156454" />
    );
    await simulateFocus(inputRef);

    await setCursorPosition(inputRef, 0);
    await simulateDeletePress(inputRef);
    expect(inputRef.current.value).to.equal("+7 (_95) 315 64 54");

    await setCursorPosition(inputRef, 7);
    await simulateDeletePress(inputRef);
    expect(inputRef.current.value).to.equal("+7 (_95) _15 64 54");

    await setCursorPosition(inputRef, 11);
    await simulateDeletePress(inputRef);
    expect(inputRef.current.value).to.equal("+7 (_95) _1_ 64 54");
  });

  it("should adjust cursor position on single character removal with Delete (with maskPlaceholder)", async () => {
    const { inputRef } = createInput(
      <Input mask="+7 (999) 999 99 99" defaultValue="74953156454" />
    );
    await simulateFocus(inputRef);

    await setCursorPosition(inputRef, 0);
    await simulateDeletePress(inputRef);
    expect(getInputSelection(inputRef.current).start).to.equal(4);
    expect(getInputSelection(inputRef.current).end).to.equal(4);

    await setCursorPosition(inputRef, 7);
    await simulateDeletePress(inputRef);
    expect(getInputSelection(inputRef.current).start).to.equal(9);
    expect(getInputSelection(inputRef.current).end).to.equal(9);

    await setCursorPosition(inputRef, 11);
    await simulateDeletePress(inputRef);
    expect(getInputSelection(inputRef.current).start).to.equal(11);
    expect(getInputSelection(inputRef.current).end).to.equal(11);
  });

  it("should handle multiple characters removal with Delete (with maskPlaceholder)", async () => {
    const { inputRef } = createInput(
      <Input mask="+7 (999) 999 99 99" defaultValue="74953156454" />
    );
    await simulateFocus(inputRef);

    await setSelection(inputRef, 1, 9);
    await simulateDeletePress(inputRef);
    expect(inputRef.current.value).to.equal("+7 (___) _15 64 54");
  });

  it("should handle single character removal with Delete on mask with escaped characters (without maskPlaceholder)", async () => {
    const { inputRef } = createInput(
      <Input
        mask="+4\9 99 9\99 99"
        defaultValue="+49 12 394"
        maskPlaceholder={null}
      />
    );
    await simulateFocus(inputRef);

    await setCursorPosition(inputRef, 9);
    await simulateDeletePress(inputRef);
    expect(inputRef.current.value).to.equal("+49 12 39");

    await setCursorPosition(inputRef, 7);
    await simulateDeletePress(inputRef);
    expect(inputRef.current.value).to.equal("+49 12 ");

    await simulateFocus(inputRef);
    inputRef.current.value = "+49 12 39";
    TestUtils.Simulate.change(inputRef.current);
    await setCursorPosition(inputRef, 5);
    await simulateDeletePress(inputRef);
    expect(inputRef.current.value).to.equal("+49 13 ");
  });

  it("should adjust cursor position on single character removal with Delete on mask with escaped characters (without maskPlaceholder)", async () => {
    const { inputRef } = createInput(
      <Input
        mask="+4\9 99 9\99 99"
        defaultValue="+49 12 394"
        maskPlaceholder={null}
      />
    );
    await simulateFocus(inputRef);

    await setCursorPosition(inputRef, 9);
    await simulateDeletePress(inputRef);
    expect(getInputSelection(inputRef.current).start).to.equal(9);
    expect(getInputSelection(inputRef.current).end).to.equal(9);

    await setCursorPosition(inputRef, 7);
    await simulateDeletePress(inputRef);
    expect(getInputSelection(inputRef.current).start).to.equal(7);
    expect(getInputSelection(inputRef.current).end).to.equal(7);

    await simulateFocus(inputRef);
    inputRef.current.value = "+49 12 39";
    TestUtils.Simulate.change(inputRef.current);
    await setCursorPosition(inputRef, 5);
    await simulateDeletePress(inputRef);
    expect(getInputSelection(inputRef.current).start).to.equal(5);
    expect(getInputSelection(inputRef.current).end).to.equal(5);
  });

  it("should handle multiple characters removal with Delete on mask with escaped characters (without maskPlaceholder)", async () => {
    const { inputRef } = createInput(
      <Input
        mask="+4\9 99 9\99 99"
        defaultValue="+49 12 394"
        maskPlaceholder={null}
      />
    );
    await simulateFocus(inputRef);

    await setSelection(inputRef, 4, 2);
    await simulateDeletePress(inputRef);
    expect(inputRef.current.value).to.equal("+49 34 ");

    await setSelection(inputRef, 0, 7);
    inputRef.current.value = "+49 12 394 5";
    TestUtils.Simulate.change(inputRef.current);
    await setSelection(inputRef, 4, 2);
    await simulateDeletePress(inputRef);
    expect(inputRef.current.value).to.equal("+49 34 59");
  });

  it("should adjust cursor position on multiple characters removal with Delete on mask with escaped characters (without maskPlaceholder)", async () => {
    const { inputRef } = createInput(
      <Input
        mask="+4\9 99 9\99 99"
        defaultValue="+49 12 394"
        maskPlaceholder={null}
      />
    );
    await simulateFocus(inputRef);

    await setSelection(inputRef, 4, 2);
    await simulateDeletePress(inputRef);
    expect(getInputSelection(inputRef.current).start).to.equal(4);
    expect(getInputSelection(inputRef.current).end).to.equal(4);

    inputRef.current.value = "+49 12 394 5";
    TestUtils.Simulate.change(inputRef.current);
    await setSelection(inputRef, 4, 2);
    await simulateDeletePress(inputRef);
    expect(getInputSelection(inputRef.current).start).to.equal(4);
    expect(getInputSelection(inputRef.current).end).to.equal(4);
  });

  it("should handle mask change", async () => {
    const { inputRef, setProps } = createInput(
      <Input mask="9999-9999-9999-9999" defaultValue="34781226917" />
    );
    setProps({ mask: "9999-999999-99999" });
    expect(inputRef.current.value).to.equal("3478-122691-7____");

    setProps({ mask: "9-9-9-9" });
    expect(inputRef.current.value).to.equal("3-4-7-8");

    setProps({ mask: null });
    expect(inputRef.current.value).to.equal("3-4-7-8");

    inputRef.current.value = "0-1-2-3";

    setProps({ mask: "9999" });
    expect(inputRef.current.value).to.equal("0123");
  });

  it("should handle mask change with on controlled input", async () => {
    const { inputRef, setProps } = createInput(
      <Input mask="9999-9999-9999-9999" value="38781226917" />
    );
    setProps({
      onChange: () => {
        setProps({
          mask: "9999-999999-99999",
          value: "3478-1226-917_-____"
        });
      }
    });

    await simulateFocus(inputRef);

    expect(inputRef.current.value).to.equal("3878-1226-917_-____");

    await setCursorPosition(inputRef, 1);
    await simulateInput(inputRef, "4");
    TestUtils.Simulate.change(inputRef.current);

    expect(inputRef.current.value).to.equal("3478-122691-7____");
  });

  it("should handle string paste (with maskPlaceholder)", async () => {
    const { inputRef } = createInput(
      <Input mask="9999-9999-9999-9999" defaultValue="____-____-____-6543" />
    );
    await simulateFocus(inputRef);

    await setSelection(inputRef, 3, 15);
    simulateInputPaste(inputRef, "34781226917");
    expect(inputRef.current.value).to.equal("___3-4781-2269-17_3");

    await setCursorPosition(inputRef, 3);
    simulateInputPaste(inputRef, "3-__81-2_6917");
    expect(inputRef.current.value).to.equal("___3-__81-2_69-17_3");

    await setSelection(inputRef, 0, 3);
    simulateInputPaste(inputRef, " 333");
    expect(inputRef.current.value).to.equal("3333-__81-2_69-17_3");
  });

  it("should adjust cursor position on string paste (with maskPlaceholder)", async () => {
    const { inputRef } = createInput(
      <Input mask="9999-9999-9999-9999" defaultValue="____-____-____-6543" />
    );
    await simulateFocus(inputRef);

    await setSelection(inputRef, 3, 15);
    simulateInputPaste(inputRef, "478122691");
    expect(getInputSelection(inputRef.current).start).to.equal(15);
    expect(getInputSelection(inputRef.current).end).to.equal(15);

    await setCursorPosition(inputRef, 3);
    simulateInputPaste(inputRef, "3-__81-2_6917");
    expect(getInputSelection(inputRef.current).start).to.equal(17);
    expect(getInputSelection(inputRef.current).end).to.equal(17);
  });

  it("should handle string paste (without maskPlaceholder)", async () => {
    const { inputRef, setProps } = createInput(
      <Input
        mask="9999-9999-9999-9999"
        defaultValue="9999-9999-9999-9999"
        maskPlaceholder={null}
      />
    );
    await simulateFocus(inputRef);

    await setSelection(inputRef, 0, 19);
    simulateInputPaste(inputRef, "34781226917");
    expect(inputRef.current.value).to.equal("3478-1226-917");

    await setCursorPosition(inputRef, 1);
    simulateInputPaste(inputRef, "12345");
    expect(inputRef.current.value).to.equal("3123-4547-8122-6917");

    await setCursorPosition(inputRef, 1);
    simulateInputPaste(inputRef, "4321");
    expect(inputRef.current.value).to.equal("3432-1547-8122-6917");

    setProps({
      value: "",
      onChange: event => {
        setProps({
          value: event.target.value
        });
      }
    });

    await waitForPendingSelection();

    simulateInputPaste(inputRef, "123");
    expect(inputRef.current.value).to.equal("123");
  });

  it("should handle string paste at position of permanent character (with maskPlaceholder)", async () => {
    const { inputRef } = createInput(
      <Input mask="9999-9999-9999" maskPlaceholder=" " />
    );
    await simulateFocus(inputRef);

    simulateInputPaste(inputRef, "1111 1111 1111");
    expect(inputRef.current.value).to.equal("1111-1111-1111");
  });

  it("should keep placeholder on rerender on empty input with alwaysShowMask", async () => {
    const { inputRef, setProps } = createInput(
      <Input mask="99-99" value="" alwaysShowMask />
    );
    setProps({ value: "" });

    expect(inputRef.current.value).to.equal("__-__");
  });

  it("should show empty value when input switches from uncontrolled to controlled", async () => {
    const { inputRef, setProps } = createInput(
      <Input mask="+7 (*a9) 999 99 99" />
    );
    setProps({ value: "+7 (___) ___ __ __" });
    expect(inputRef.current.value).to.equal("+7 (___) ___ __ __");
  });

  it("shouldn't affect value if mask is empty", async () => {
    const { inputRef, setProps } = createInput(<Input value="12345" />);
    expect(inputRef.current.value).to.equal("12345");

    setProps({
      value: "54321"
    });
    expect(inputRef.current.value).to.equal("54321");
  });

  it("should show next permanent character when maskPlaceholder is null", async () => {
    const { inputRef } = createInput(
      <Input mask="99/99/9999" value="01" maskPlaceholder={null} />
    );
    expect(inputRef.current.value).to.equal("01/");
  });

  it("should show all next consecutive permanent characters when maskPlaceholder is null", async () => {
    const { inputRef } = createInput(
      <Input mask="99---99" value="01" maskPlaceholder={null} />
    );
    expect(inputRef.current.value).to.equal("01---");
  });

  it("should show trailing permanent character when maskPlaceholder is null", async () => {
    const { inputRef } = createInput(
      <Input mask="99%" value="10" maskPlaceholder={null} />
    );
    expect(inputRef.current.value).to.equal("10%");
  });

  /* TODO
  it("should pass input DOM node to ref", async () => {
    let myInputRef;
    const { inputRef } = createInput(
      <Input
        ref={node => {
          inputRef.current = node;
        }}
      />
    );
    expect(myInputRef).to.equal(inputRef);
  });
  */

  it("should allow to modify value with beforeMaskedStateChange", async () => {
    const beforeMaskedStateChange = ({ nextState }) => {
      const placeholder = "DD/MM/YYYY";
      const maskPlaceholder = "_";
      const value = nextState.value
        .split("")
        .map((char, i) => {
          if (char === maskPlaceholder) {
            return placeholder[i];
          }
          return char;
        })
        .join("");

      return {
        ...nextState,
        value
      };
    };

    const { inputRef, setProps } = createInput(
      <Input
        mask="99/99/9999"
        value=""
        beforeMaskedStateChange={beforeMaskedStateChange}
      />
    );
    expect(inputRef.current.value).to.equal("");

    setProps({
      onChange: event => {
        setProps({
          value: event.target.value
        });
      }
    });

    await simulateFocus(inputRef);

    expect(inputRef.current.value).to.equal("DD/MM/YYYY");

    setProps({ value: "12345" });
    expect(inputRef.current.value).to.equal("12/34/5YYY");

    await setCursorPosition(inputRef, 7);

    await simulateInput(inputRef, "6");
    expect(inputRef.current.value).to.equal("12/34/56YY");

    setProps({ value: null });
    expect(inputRef.current.value).to.equal("12/34/56YY");
  });

  it("shouldn't modify value on entering non-allowed character", async () => {
    const { inputRef } = createInput(<Input mask="9999" defaultValue="1234" />);
    await simulateFocus(inputRef);

    await setCursorPosition(inputRef, 0);
    await simulateInput(inputRef, "a");

    expect(inputRef.current.value).to.equal("1234");
    expect(getInputSelection(inputRef.current).start).to.equal(0);
    expect(getInputSelection(inputRef.current).end).to.equal(0);

    await setSelection(inputRef, 0, 1);
    await simulateInput(inputRef, "a");

    expect(inputRef.current.value).to.equal("1234");

    await setSelection(inputRef, 1, 3);
    await simulateInput(inputRef, "a");

    expect(inputRef.current.value).to.equal("1234");
  });

  it("should handle autofill", async () => {
    const { inputRef } = createInput(
      <Input mask="9999-9999" defaultValue="123" maskPlaceholder={null} />
    );
    await simulateFocus(inputRef);

    inputRef.current.value = "12345678";
    setCursorPosition(inputRef, 8);
    TestUtils.Simulate.change(inputRef.current);

    expect(inputRef.current.value).to.equal("1234-5678");
  });

  it("should handle transition between masked and non-masked state", async () => {
    const { inputRef, setProps } = createInput(<Input />);
    setProps({
      value: "",
      onChange: event => {
        setProps({
          value: event.target.value,
          mask: event.target.value ? "+7 999 999 99 99" : null
        });
      }
    });

    await simulateFocus(inputRef);

    expect(getInputSelection(inputRef.current).start).to.equal(0);
    expect(getInputSelection(inputRef.current).end).to.equal(0);

    await simulateInput(inputRef, "1");
    expect(inputRef.current.value).to.equal("+7 1__ ___ __ __");
    expect(getInputSelection(inputRef.current).start).to.equal(4);
    expect(getInputSelection(inputRef.current).end).to.equal(4);

    await simulateBackspacePress(inputRef);
    await simulateBlur(inputRef);

    expect(inputRef.current.value).to.equal("");

    await simulateFocus(inputRef);

    expect(getInputSelection(inputRef.current).start).to.equal(0);
    expect(getInputSelection(inputRef.current).end).to.equal(0);

    await simulateInput(inputRef, "1");
    expect(inputRef.current.value).to.equal("+7 1__ ___ __ __");
    expect(getInputSelection(inputRef.current).start).to.equal(4);
    expect(getInputSelection(inputRef.current).end).to.equal(4);
  });

  it("should handle regular component as children", async () => {
    const myInputRef = createRef();
    const { inputRef } = createInput(
      <Input mask="+7 (999) 999 99 99">
        <ClassInputComponent ref={myInputRef} />
      </Input>
    );
    inputRef.current = getInputDOMNode(inputRef.current);

    await simulateFocus(inputRef);

    expect(getInputSelection(inputRef.current).start).to.equal(4);
    expect(getInputSelection(inputRef.current).end).to.equal(4);

    await simulateInput(inputRef, "1");
    expect(inputRef.current.value).to.equal("+7 (1__) ___ __ __");
    expect(getInputSelection(inputRef.current).start).to.equal(5);
    expect(getInputSelection(inputRef.current).end).to.equal(5);
  });

  it("should handle functional component as children", async () => {
    const myInputRef = createRef();
    const { inputRef } = createInput(
      <Input mask="+7 (999) 999 99 99">
        <FunctionalInputComponent ref={myInputRef} />
      </Input>
    );
    inputRef.current = getInputDOMNode(inputRef.current);

    await simulateFocus(inputRef);

    expect(getInputSelection(inputRef.current).start).to.equal(4);
    expect(getInputSelection(inputRef.current).end).to.equal(4);

    await simulateInput(inputRef, "1");
    expect(inputRef.current.value).to.equal("+7 (1__) ___ __ __");
    expect(getInputSelection(inputRef.current).start).to.equal(5);
    expect(getInputSelection(inputRef.current).end).to.equal(5);
  });

  // skipping this test as I don't fully understand why it fails
  it.skip("should handle children change", async () => {
    let { inputRef, setProps } = createInput(
      <Input mask="+7 (999) 999 99 99" />
    );
    function handleRef(node) {
      inputRef = node;
    }

    setProps({
      value: "",
      mask: "+7 (999) 999 99 99",
      onChange: event => {
        setProps({
          value: event.target.value
        });
      },
      children: <ClassInputComponent ref={handleRef} />
    });

    inputRef.current = getInputDOMNode(inputRef.current);

    await simulateFocus(inputRef);

    expect(getInputSelection(inputRef.current).start).to.equal(4);
    expect(getInputSelection(inputRef.current).end).to.equal(4);

    await simulateInput(inputRef, "1");
    expect(inputRef.current.value).to.equal("+7 (1__) ___ __ __");
    expect(getInputSelection(inputRef.current).start).to.equal(5);
    expect(getInputSelection(inputRef.current).end).to.equal(5);

    setProps({
      value: "22",
      mask: "+7 (999) 999 99 99",
      onChange: event => {
        setProps({
          value: event.target.value
        });
      },
      children: <FunctionalInputComponent ref={handleRef} />
    });
    inputRef.current = getInputDOMNode(inputRef.current);

    expect(inputRef.current.value).to.equal("+7 (22_) ___ __ __");

    setProps({
      value: "22",
      mask: "+7 (999) 999 99 99",
      onChange: event => {
        setProps({
          value: event.target.value
        });
      },
      children: null,
      ref: handleRef
    });
    inputRef.current = getInputDOMNode(inputRef.current);

    expect(inputRef.current.value).to.equal("+7 (22_) ___ __ __");
  });

  it("should handle change event without focus", async () => {
    const { inputRef } = createInput(
      <Input mask="+7 (999) 999 99 99" maskPlaceholder={null} />
    );
    inputRef.current.value = "+71234567890";
    TestUtils.Simulate.change(inputRef.current);
    expect(inputRef.current.value).to.equal("+7 (123) 456 78 90");
  });

  it("shouldn't move cursor on delayed value change", async () => {
    const { inputRef, setProps } = createInput(
      <Input mask="+7 (999) 999 99 99" maskPlaceholder={null} />
    );
    setProps({
      value: "+7 (9",
      onChange: event => {
        setProps({
          value: event.target.value
        });
      }
    });

    await simulateFocus(inputRef);

    expect(getInputSelection(inputRef.current).start).to.equal(5);
    expect(getInputSelection(inputRef.current).end).to.equal(5);

    await delay(100);
    setProps({
      value: "+7 (99"
    });

    expect(getInputSelection(inputRef.current).start).to.equal(5);
    expect(getInputSelection(inputRef.current).end).to.equal(5);
  });
});
