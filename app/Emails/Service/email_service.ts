'use server';
import { requireSession } from '@/lib/session';

import { resolveCustomerEmailTargets, getAllCustomerEmailsStrict, getLuluEmailsStrict } from '@/lib/supabase';

export async function getCustomerEmails(customerName?: string) {
  await requireSession();
  try {
    if (customerName) {
      const { customers, emails } = await resolveCustomerEmailTargets(customerName);
      const email = emails.length ? emails.join(', ') : null;
      return { email, emails, customers };
    }

    const customersWithEmails = await getAllCustomerEmailsStrict();
    return { customers: customersWithEmails };
  } catch (error) {
    console.error('Service Error:', error);
    throw new Error('Failed to fetch customer emails');
  }
}

export async function getLuluCustomerEmails() {
  await requireSession();
  try {
    const luluEmails = await getLuluEmailsStrict();
    return { customers: luluEmails };
  } catch (error) {
    console.error('Service Error:', error);
    throw new Error('Failed to fetch lulu emails list');
  }
}
