export type ActionResult<TData = unknown> =
  | {
      ok: true;
      data: TData;
    }
  | {
      ok: false;
      error: string;
      fieldErrors?: Record<string, string[]>;
    };
