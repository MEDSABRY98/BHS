// Every form in the Forms module. Add a new form here (and a folder next to EmployeeCharge),
// its database table starts with form_ (e.g. form_EMPLOYEE_CHARGES),
// then add the same id to the 'forms' sub-tabs in Admin Control.

export const FORMS_SYSTEM_ID = 'forms';

export interface FormDefinition {
  id: string;           // permission id (Admin Control → Forms)
  title: string;
  description: string;
  path: string;         // route
}

export const FORMS: FormDefinition[] = [
  {
    id: 'employee-charge',
    title: 'Employee Charge',
    description: 'Charge an amount to an employee, with the details and how it will be settled.',
    path: '/Forms/EmployeeCharge',
  },
  {
    id: 'letterhead',
    title: 'Company Letter',
    description: 'Write a letter and print it on the company letterhead paper.',
    path: '/Forms/Letterhead',
  },
];
