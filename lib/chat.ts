import { router } from 'expo-router';
import { supabase } from './supabase';

export async function startOrOpenChat(
  myId: string,
  myNickname: string,
  partnerId: string,
  partnerNickname: string
): Promise<void> {
  // Find existing room between the two users
  const { data: existing } = await supabase
    .from('chat_rooms')
    .select('id')
    .or(
      `and(user1_id.eq.${myId},user2_id.eq.${partnerId}),and(user1_id.eq.${partnerId},user2_id.eq.${myId})`
    )
    .maybeSingle();

  let roomId: string;

  if (existing) {
    roomId = existing.id;
  } else {
    const { data: newRoom, error } = await supabase
      .from('chat_rooms')
      .insert({
        user1_id: myId,
        user2_id: partnerId,
        user1_nickname: myNickname,
        user2_nickname: partnerNickname,
        last_message: '',
        last_message_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (error || !newRoom) throw error ?? new Error('채팅방 생성 실패');
    roomId = newRoom.id;
  }

  router.push({ pathname: '/chat/[roomId]' as any, params: { roomId } });
}
