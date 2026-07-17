export function normalizeCustomerKey(value: unknown): string {
  return String(value || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

export type CustomerIdNameRow = {
  id: string;
  name: string;
};

export function buildCustomerEmailMap(
  emails: { customerId?: string; email?: string }[],
  customers: CustomerIdNameRow[] = []
): Map<string, string> {
  const emailMap = new Map<string, string>();
  const idByName = new Map<string, string>();
  const nameById = new Map<string, string>();

  for (const customer of customers) {
    const id = normalizeCustomerKey(customer.id);
    const name = normalizeCustomerKey(customer.name);
    if (id && name) {
      idByName.set(name, id);
      nameById.set(id, name);
    }
  }

  for (const item of emails) {
    if (!item?.customerId || !item.email) continue;

    const key = normalizeCustomerKey(item.customerId);
    emailMap.set(key, item.email);

    const resolvedId = idByName.get(key);
    if (resolvedId) emailMap.set(resolvedId, item.email);

    const resolvedName = nameById.get(key);
    if (resolvedName) emailMap.set(resolvedName, item.email);
  }

  return emailMap;
}

export function getCustomerEmail(
  emailMap: Map<string, string>,
  customerId: string,
  customerName?: string
): string {
  return (
    emailMap.get(normalizeCustomerKey(customerId)) ||
    (customerName ? emailMap.get(normalizeCustomerKey(customerName)) : '') ||
    ''
  );
}

export function hasCustomerEmail(
  emailMap: Map<string, string>,
  customerId: string,
  customerName?: string
): boolean {
  return !!getCustomerEmail(emailMap, customerId, customerName);
}
