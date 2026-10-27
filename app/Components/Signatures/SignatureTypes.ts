// Signatures on the PDFs — shared types.
// The people who may sign are kept in web_SIGNATORIES (Data Base → Signatories DB).
// Every PDF with a signature part asks, when it is exported, who signs and in which order
// (pickSignatures); nobody chosen = no signature part at all.

/** a person in Data Base → Signatories DB */
export interface Signatory {
  ID: string;
  NAME: string;
  TITLE: string;
  IS_ACTIVE: boolean;
  SORT_ORDER: number;
}

/** one signature box on the PDF */
export interface Signer {
  title: string; // the position, e.g. Accounts Department / CEO
  name: string; // may be empty (a blank to write the name)
  image?: string | null; // optional signature image (base64 PNG)
}
