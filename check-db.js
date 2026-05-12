const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');

const EXPECTED_SUPABASE_URL = 'https://mdrrcrmowurbrwvdsgnq.supabase.co';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL and a Supabase key in the environment.');
  process.exit(1);
}

if (supabaseUrl !== EXPECTED_SUPABASE_URL) {
  console.error(`Refusing to run against ${supabaseUrl}. Expected ${EXPECTED_SUPABASE_URL}.`);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  realtime: {
    transport: WebSocket,
  },
});

async function checkDatabase() {
  try {
    console.log('Checking Elite Funding Solutions Supabase connection...\n');

    const tables = [
      'organizations',
      'user_profiles',
      'leads',
      'businesses',
      'owners',
      'business_owners',
      'deals',
      'applications',
      'documents',
      'pipeline_stages',
    ];

    for (const table of tables) {
      const { error } = await supabase.from(table).select('*').limit(1);

      if (error) {
        console.log(`❌ ${table}: ${error.message}`);
        return false;
      }

      console.log(`✅ ${table}: exists`);
    }

    const { error: ssnColumnError } = await supabase.from('owners').select('ssn_encrypted').limit(1);
    const { error: routingColumnError } = await supabase.from('applications').select('routing_number_encrypted').limit(1);
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();

    if (ssnColumnError) {
      console.log(`❌ owners.ssn_encrypted: ${ssnColumnError.message}`);
      return false;
    }
    console.log('✅ owners.ssn_encrypted: exists');

    if (routingColumnError) {
      console.log(`❌ applications.routing_number_encrypted: ${routingColumnError.message}`);
      return false;
    }
    console.log('✅ applications.routing_number_encrypted: exists');

    if (bucketError) {
      console.log(`❌ storage buckets: ${bucketError.message}`);
      return false;
    }

    const applicationBucket = buckets.find((bucket) => bucket.name === 'application-documents');
    if (!applicationBucket) {
      console.log('❌ application-documents bucket: not found');
      return false;
    }

    console.log(`✅ application-documents bucket: exists, public=${applicationBucket.public}`);
    console.log('\n✅ Elite Funding Solutions database checks passed.\n');
    return true;
  } catch (error) {
    console.error('❌ Error checking database:', error.message);
    return false;
  }
}

checkDatabase().then((success) => process.exit(success ? 0 : 1));
