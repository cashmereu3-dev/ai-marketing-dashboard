import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const { task_type, data } = payload;
    
    // We use the service role key to bypass RLS securely from the server
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Supabase credentials missing' }, { status: 500 });
    }
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    if (task_type === 'new_lead') {
      const { error } = await supabaseAdmin.from('leads').insert(data);
      if (error) throw error;
      
    } else if (task_type === 'asset_ready') {
      const { error } = await supabaseAdmin
        .from('assets')
        .update({ status: 'ready' })
        .eq('id', data.asset_id);
      if (error) throw error;
      
    } else if (task_type === 'campaign_update') {
      const { error } = await supabaseAdmin
        .from('campaigns')
        .update({ status: data.status })
        .eq('id', data.campaign_id);
      if (error) throw error;
    }

    return NextResponse.json({ success: true, message: `Processed task: ${task_type}` }, { status: 200 });
    
  } catch (error: any) {
    console.error("Webhook Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
