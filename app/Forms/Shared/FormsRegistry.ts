// Every form in the Forms module. Add a new form here (and a folder next to the others),
// then add the same id (and '<id>-archive' for its archive) to the 'forms' sub-tabs in Admin Control.
// Saved forms go to one table for all forms: web_FORMS_ARCHIVE (number: PREFIX-YEAR-0001).

export const FORMS_SYSTEM_ID = 'forms';

export interface FormDefinition {
  id: string;           // permission id (Admin Control → Forms)
  title: string;
  description: string;
  path: string;         // route
  prefix: string;       // letters of the saved number, e.g. VE → VE-2026-0001
}

export const FORMS: FormDefinition[] = [
  {
    id: 'letterhead',
    title: 'Company Letter',
    description: 'Write a letter and print it on the company letterhead paper.',
    path: '/Forms/Letterhead',
    prefix: 'CL',
  },
  {
    id: 'file-labels',
    title: 'File Labels',
    description: 'Print file spine labels at their real size, the name fitted to each label.',
    path: '/Forms/FileLabels',
    prefix: 'FL',
  },
  {
    id: 'intercompany',
    title: 'Intercompany Reconciliation',
    description: 'Al Ain ↔ Dubai: download the Excel template, upload it and download the analysis PDF.',
    path: '/Forms/Intercompany',
    prefix: 'IC',
  },
  {
    id: 'supplier-payment',
    title: 'Supplier Payment',
    description: 'Payment to a supplier by cheque or bank transfer: fill the form and download the PDF.',
    path: '/Forms/SupplierPayment',
    prefix: 'SP',
  },
  {
    id: 'vehicle-expenses',
    title: 'Vehicle Expenses',
    description: 'Fuel and maintenance per vehicle: download the Excel template, upload it and download the analysis PDF.',
    path: '/Forms/VehicleExpenses',
    prefix: 'VE',
  },
];

export const formById = (id: string) => FORMS.find((f) => f.id === id);
/** Admin Control sub-tab that opens the archive of a form */
export const archiveTabId = (formId: string) => `${formId}-archive`;
