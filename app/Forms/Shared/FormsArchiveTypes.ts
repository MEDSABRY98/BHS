// Saved forms (web_FORMS_ARCHIVE): one table for every form; each form keeps its own data in DATA.

export type FormTabId = 'new' | 'archive';

export interface FormAccess {
  use: boolean;     // can fill / save the form
  archive: boolean; // can see the saved forms
  admin: boolean;   // sees everyone's forms, edits and deletes
}

export interface FormRecord<T = any> {
  ID: string;               // uuid
  FORM_ID: string;
  TITLE: string;
  REF_NO: string;           // e.g. VE-2026-0001
  DOC_DATE: string | null;  // yyyy-mm-dd
  AMOUNT: number | null;
  DATA: T;
  CREATED_BY: string;
  CREATED_BY_NAME?: string;
  CREATED_AT: string;
  UPDATED_AT?: string | null;
}

/** what a form gives to be saved */
export interface FormSavePayload<T = any> {
  TITLE: string;
  DOC_DATE: string | null;
  AMOUNT: number | null;
  DATA: T;
}

/** what the shell gives to the form editor */
export interface FormEditorContext<T = any> {
  /** the saved form being edited (admin), or null for a new one */
  editing: FormRecord<T> | null;
  /** header slot for the form's own icon buttons (createPortal) */
  actionsEl: HTMLDivElement | null;
  /** the form tells the shell how to read it for Save; return null when it is not ready (show the error yourself) */
  registerSave: (fn: (() => FormSavePayload<T> | null) | null) => void;
  /** true right after a save: start empty (do not restore a browser draft) */
  startEmpty: boolean;
}
