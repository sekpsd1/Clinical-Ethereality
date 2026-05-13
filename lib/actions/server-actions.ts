import type { z } from "zod";

export type FormActionStatus = "idle" | "success" | "error";

export type FormActionState = {
  status: FormActionStatus;
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export const initialFormActionState: FormActionState = {
  status: "idle",
  message: ""
};

export function formDataToObject(formData: FormData): Record<string, FormDataEntryValue | FormDataEntryValue[]> {
  const data: Record<string, FormDataEntryValue | FormDataEntryValue[]> = {};

  formData.forEach((value, key) => {
    const existingValue = data[key];

    if (Array.isArray(existingValue)) {
      existingValue.push(value);
      return;
    }

    data[key] = existingValue === undefined ? value : [existingValue, value];
  });

  return data;
}

export function actionError(message: string, error?: z.ZodError): FormActionState {
  const flattenedErrors = error?.flatten().fieldErrors;
  const fieldErrors = flattenedErrors
    ? Object.fromEntries(
        Object.entries(flattenedErrors).filter((entry): entry is [string, string[]] => Array.isArray(entry[1]))
      )
    : undefined;

  return {
    status: "error",
    message,
    fieldErrors
  };
}

export function actionSuccess(message: string): FormActionState {
  return {
    status: "success",
    message
  };
}
