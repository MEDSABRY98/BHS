'use server';

import { resolveCustomerEmailTargets, getAllCustomerEmails, getLuluEmails } from '@/lib/supabase';

export async function getCustomerEmails(customerName?: string) {
  try {
    if (customerName) {
      const { customers, emails } = await resolveCustomerEmailTargets(customerName);
      const email = emails[0] ?? null;
      return { email, emails, customers };
    }

    const customersWithEmails = await getAllCustomerEmails();
    return { customers: customersWithEmails };
  } catch (error) {
    console.error('Service Error:', error);
    throw new Error('Failed to fetch customer emails');
  }
}

export async function getLuluCustomerEmails() {
  try {
    const luluEmails = await getLuluEmails();
    return { customers: luluEmails };
  } catch (error) {
    console.error('Service Error:', error);
    throw new Error('Failed to fetch lulu emails list');
  }
}
