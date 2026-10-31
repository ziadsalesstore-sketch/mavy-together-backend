import { useState } from "react";
import { TextField } from "@shopify/polaris";

/** Polaris TextField that keeps its own state and submits natively through its `name`. */
export function Field(props: {
  name: string;
  label: string;
  defaultValue?: string | null;
  helpText?: string;
  multiline?: number;
  type?: "text" | "url" | "datetime-local";
  error?: string;
  requiredField?: boolean;
}) {
  const [value, setValue] = useState(props.defaultValue ?? "");
  return (
    <TextField
      label={props.label}
      name={props.name}
      value={value}
      onChange={setValue}
      helpText={props.helpText}
      multiline={props.multiline}
      type={props.type}
      error={props.error}
      requiredIndicator={props.requiredField}
      autoComplete="off"
    />
  );
}
