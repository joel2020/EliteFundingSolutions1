const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');

const supabaseUrl = 'https://mdrrcrmowurbrwvdsgnq.supabase.co';
const supabaseKey = 'sb_secret_6qhT2v1kdR6_wpXq1_Y3dg_okF4F7HQ';

const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: {
    transport: WebSocket,
  },
});

async function checkDatabase() {
  try {
    console.log('Checking Supabase connection...\n');
    
    // Check if organizations table exists
    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select('*')
      .limit(1);
    
    if (orgsError) {
      console.log('❌ Organizations table error:', orgsError.message);
      console.log('This likely means migrations have NOT been applied yet.\n');
      return false;
    } else {
      console.log('✅ Organizations table exists');
      console.log('Found', orgs ? orgs.length : 0, 'organization(s)\n');
    }

    // Check other key tables
    const tables = ['user_profiles', 'leads', 'businesses', 'deals', 'applications', 'pipeline_stages'];
    
    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select('count')
        .limit(1);
      
      if (error) {
        console.log(`❌ ${table} table: NOT FOUND`);
      } else {
        console.log(`✅ ${table} table: EXISTS`);
      }
    }

    console.log('\n✅ Database connection successful!');
    console.log('✅ Migrations appear to be applied!\n');
    return true;
    
  } catch (error) {
    console.error('❌ Error checking database:', error.message);
    return false;
  }
}

checkDatabase().then(() => process.exit(0));
