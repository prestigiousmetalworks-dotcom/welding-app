// HotPass — Send Notification Edge Function
// Sends Expo push notifications and logs them to the notification table

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

type NotificationType = 'like' | 'comment' | 'follow' | 'challenge_result' | 'score_complete';

interface PushPayload {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: string;
  badge?: number;
}

// ----------------------------------------------------------------
// Notification templates
// ----------------------------------------------------------------
function buildNotification(type: NotificationType, data: Record<string, string>): { title: string; body: string } {
  switch (type) {
    case 'like':
      return {
        title: '🔥 New Like',
        body: `${data.from_username} liked your weld (${data.score ?? ''}${data.grade ? ' · ' + data.grade : ''})`,
      };
    case 'comment':
      return {
        title: '💬 New Comment',
        body: `${data.from_username}: "${data.comment_preview}"`,
      };
    case 'follow':
      return {
        title: '👤 New Follower',
        body: `${data.from_username} started following you`,
      };
    case 'challenge_result':
      return {
        title: '🏆 Challenge Results',
        body: data.won === 'true'
          ? `You won this week's challenge — ${data.challenge_title}!`
          : `Week ${data.week} results are in. You ranked #${data.rank} — ${data.challenge_title}`,
      };
    case 'score_complete':
      return {
        title: '⚡ Weld Scored',
        body: `Your weld scored ${data.score}/100 · Grade ${data.grade}`,
      };
    default:
      return { title: 'HotPass', body: 'You have a new notification' };
  }
}

// ----------------------------------------------------------------
// Main handler
// ----------------------------------------------------------------
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const {
      user_id,       // recipient's user ID
      type,          // NotificationType
      data = {},     // template variables
    } = await req.json();

    if (!user_id || !type) {
      return new Response(JSON.stringify({ error: 'user_id and type are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get recipient's push token
    const { data: profile } = await supabase
      .from('user_profile')
      .select('push_token, username')
      .eq('id', user_id)
      .single();

    const { title, body } = buildNotification(type as NotificationType, data);

    // Log notification to DB regardless of push token
    await supabase.from('notification').insert({
      user_id,
      type,
      title,
      body,
      data,
    });

    // Send push if token exists
    let pushResult = null;
    if (profile?.push_token) {
      const payload: PushPayload = {
        to: profile.push_token,
        title,
        body,
        data,
        sound: 'default',
      };

      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      pushResult = await response.json();
    }

    return new Response(JSON.stringify({
      success: true,
      notification_logged: true,
      push_sent: !!profile?.push_token,
      push_result: pushResult,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('send-notification error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
