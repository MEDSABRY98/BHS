const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://asdaegnucbxgvomtutcf.supabase.co';
const supabaseKey = 'sb_publishable_BEO5vo3H3RxrWtu6W242UA_2APT73ca';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('Querying app_lpos_USERS...');
  const { data: users, error: err1 } = await supabase
    .from('app_lpos_USERS')
    .select('ID, NAME, USER_TYPE, ROLE');
  
  if (err1) {
    console.error('Error fetching users:', err1);
  } else {
    console.log('\n--- USERS LIST ---');
    console.log(JSON.stringify(users, null, 2));
  }

  console.log('\nQuerying distinct DRIVERS_NAME and ASSISTANT_NAME from app_lpos_DRIVERS...');
  const { data: drivers, error: err2 } = await supabase
    .from('app_lpos_DRIVERS')
    .select('DRIVERS_NAME, ASSISTANT_NAME');
  
  if (err2) {
    console.error('Error fetching drivers:', err2);
  } else {
    const uniqueStaffIds = new Set();
    drivers.forEach(d => {
      if (d.DRIVERS_NAME) uniqueStaffIds.add(d.DRIVERS_NAME);
      if (d.ASSISTANT_NAME) uniqueStaffIds.add(d.ASSISTANT_NAME);
    });
    console.log('\n--- DISTINCT STAFF/USER IDs IN DRIVERS TABLE ---');
    console.log(Array.from(uniqueStaffIds));
  }
}

main();
