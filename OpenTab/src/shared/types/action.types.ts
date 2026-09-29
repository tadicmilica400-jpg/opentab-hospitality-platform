export type ActionResult =
  | {
      ok: true;
      message?: never;
    }
  | {
      ok: false;
      message: string;
    };
