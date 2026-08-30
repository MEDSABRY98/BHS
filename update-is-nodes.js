const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf-8').split('\n').reduce((acc, line) => {
  const [k, v] = line.split('=');
  if (k && v) acc[k.trim()] = v.trim();
  return acc;
}, {});

const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = env['SUPABASE_SERVICE_ROLE_KEY'] || env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
const supabase = createClient(supabaseUrl, supabaseKey);

async function updateISNodes() {
  const { data: tpl } = await supabase.from('fn_StatementTemplates').select('TemplateID').eq('StatementType', 'IncomeStatement').single();
  const templateId = tpl.TemplateID;

  console.log('Deleting old mappings and nodes for IS...');
  const { data: oldNodes } = await supabase.from('fn_TemplateNodes').select('NodeID').eq('TemplateID', templateId);
  const oldNodeIds = oldNodes.map(n => n.NodeID);
  
  if (oldNodeIds.length > 0) {
    await supabase.from('fn_AccountMapping').delete().in('NodeID', oldNodeIds);
    await supabase.from('fn_TemplateNodes').delete().eq('TemplateID', templateId);
  }

  console.log('Inserting new IS nodes...');
  const newNodes = [
    { TemplateID: templateId, NodeName: 'Revenue', OrderIndex: 1 },
    { TemplateID: templateId, NodeName: 'Less Costs of Revenue', OrderIndex: 2 },
    { TemplateID: templateId, NodeName: 'Less Operating Expenses', OrderIndex: 3 },
    { TemplateID: templateId, NodeName: 'Plus Other Income', OrderIndex: 4 },
    { TemplateID: templateId, NodeName: 'Less General & Administrative Expenses', OrderIndex: 5 },
  ];

  const { data: insertedNodes, error: err1 } = await supabase.from('fn_TemplateNodes').insert(newNodes).select();
  if (err1) throw err1;

  console.log('Fetching Accounts to map to new nodes...');
  const { data: accounts } = await supabase.from('fn_Accounts').select('*');

  const nodesDict = insertedNodes.reduce((acc, n) => {
    acc[n.NodeName] = n.NodeID;
    return acc;
  }, {});

  const mappings = [];
  for (const acc of accounts) {
    const code = acc.AccountCode;
    const name = acc.AccountName.toLowerCase();
    
    let nodeId = null;

    if (code.startsWith('3')) {
      if (code.startsWith('3102') || name.includes('cost of')) nodeId = nodesDict['Less Costs of Revenue'];
      else if (code.startsWith('32') || name.includes('admin') || name.includes('عمومية')) nodeId = nodesDict['Less General & Administrative Expenses'];
      else nodeId = nodesDict['Less Operating Expenses'];
    } else if (code.startsWith('4')) {
      if (code.startsWith('44') || name.includes('other income')) nodeId = nodesDict['Plus Other Income'];
      else nodeId = nodesDict['Revenue'];
    }

    if (nodeId) {
      mappings.push({ AccountCode: code, NodeID: nodeId });
    }
  }

  console.log(`Inserting ${mappings.length} mappings...`);
  if (mappings.length > 0) {
    const { error: err2 } = await supabase.from('fn_AccountMapping').upsert(mappings, { onConflict: 'AccountCode,NodeID' });
    if (err2) throw err2;
  }
  
  console.log('Done!');
}

updateISNodes().catch(console.error);
