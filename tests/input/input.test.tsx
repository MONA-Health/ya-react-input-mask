/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-nonoctal-decimal-escape */
/* global describe, it, afterEach */
import * as React from "react";
import * as ReactDOM from "react-dom";
import TestUtils from "react-dom/test-utils";
import { expect } from "chai";
import * as deferUtils from "../../src/utils/defer";
import Input from "../../src";
import { getInputSelection } from "../../src/utils/input";

document.body.innerHTML = '<div id="container"></div>';
const container = document.getElementById("container");

async function delay(duration: number) {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, duration);
  });
}

async function defer() {
  await new Promise<void>((resolve) => {
    deferUtils.defer(resolve);
  });
}

async function setSelection(
  input: HTMLInputElement,
  start: number,
  length: number,
) {
  input.setSelectionRange(start, start + length);
  await defer();
}

async function setCursorPosition(input: HTMLInputElement, start: number) {
  await setSelection(input, start, 0);
}

async function waitForPendingSelection() {
  await defer();
}

function getInputDOMNode(input: Element): HTMLInputElement {
  if (input.nodeName !== "INPUT") {
    input = input.querySelector("input") as Element;
  }
  if (!input) {
    throw new Error("inputComponent doesn't contain input node");
  }
  return input as HTMLInputElement;
}

function createInput(component: JSX.Element) {
  const originalRef = (component as any).ref;
  let { props } = component;
  let input: HTMLInputElement = new HTMLInputElement();

  const refCallback = (node: HTMLInputElement) => {
    input = node;
    if (typeof originalRef === "function") {
      originalRef(node);
    } else if (originalRef !== null && typeof originalRef === "object") {
      originalRef.current = node;
    }
  };

  component = React.cloneElement(component, {
    ref: refCallback,
  });

  function setProps(newProps: any) {
    props = {
      ...props,
      ...newProps,
    };
    ReactDOM.render(React.createElement(Input, props), container);
  }

  ReactDOM.render(component, container);

  return { input, setProps };
}

async function simulateFocus(input: HTMLInputElement) {
  input.focus();
  TestUtils.Simulate.focus(input);
  await defer();
}

async function simulateBlur(input: HTMLInputElement) {
  input.blur();
  TestUtils.Simulate.blur(input);
}

async function simulateInput(input: HTMLInputElement, string: string) {
  const { start, end } = getInputSelection(input);
  const { value } = input;
  const maybeStart = start || 0;
  const maybeEnd = end || 0;
  const valueBefore = value.slice(0, maybeStart);
  const valueAfter = value.slice(maybeEnd);
  input.value = valueBefore + string + valueAfter;
  setCursorPosition(input, maybeStart + string.length);
  TestUtils.Simulate.change(input);
}

async function simulateInputPaste(input: HTMLInputElement, string: string) {
  TestUtils.Simulate.paste(input);
  await simulateInput(input, string);
}

async function simulateBackspacePress(input: HTMLInputElement) {
  const selection = getInputSelection(input);
  const { start, end } = selection;
  const { value } = input;
  const maybeStart = start || 0;
  const maybeEnd = end || 0;

  if (selection.length) {
    input.value = value.slice(0, maybeStart) + value.slice(maybeEnd);
    setSelection(input, maybeStart, 0);
  } else if (start) {
    input.value = value.slice(0, start - 1) + value.slice(maybeEnd);
    setSelection(input, start - 1, 0);
  }

  TestUtils.Simulate.change(input);
}

async function simulateDeletePress(input: HTMLInputElement) {
  const { start, end } = getInputSelection(input);
  const { value } = input;
  const maybeStart = start || 0;
  const maybeEnd = end || 0;
  const removedLength = maybeEnd - maybeStart || 1;
  const valueBefore = value.slice(0, maybeStart);
  const valueAfter = value.slice(maybeStart + removedLength);
  input.value = valueBefore + valueAfter;
  setCursorPosition(input, maybeStart);
  TestUtils.Simulate.change(input);
}

interface InputProps {
  innerRef: React.Ref<HTMLInputElement>;
}

class InnerClassInputComponent extends React.Component<InputProps> {
  render() {
    const { innerRef, ...restProps } = this.props;
    return (
      <div>
        <input ref={innerRef} {...restProps} />
      </div>
    );
  }
}

const ClassInputComponent = React.forwardRef(
  (props: any, ref: React.Ref<HTMLDivElement>) => (
    <InnerClassInputComponent innerRef={ref} {...props} />
  ),
);

const FunctionalInputComponent = React.forwardRef(
  (props: any, ref: React.Ref<HTMLDivElement>) => (
    <div ref={ref}>
      <div>
        <input {...props} />
      </div>
    </div>
  ),
);

describe("react-input-mask", () => {
  afterEach(() => {
    ReactDOM.unmountComponentAtNode(container as Element);
  });

  it("should format value on mount", async () => {
    const { input } = createInput(
      <Input mask="+7 (999) 999 99 99" defaultValue="74953156454" />,
    );
    expect(input.value).to.equal("+7 (495) 315 64 54");
  });

  // Rest of the tests...
});
