import React, { ReactElement } from "react";

interface Props {
  children: ReactElement;
}

export default class InputMaskChildrenWrapper extends React.Component<Props> {
  render() {
    // eslint-disable-next-line react/prop-types
    const { children, ...props } = this.props;
    return React.cloneElement(children, props);
  }
}
