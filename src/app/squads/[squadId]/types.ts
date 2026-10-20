export type RoomMember = {
  member_user_id: string;
  nama_lengkap: string;
  nama_class: string | null;
  role_squad: string;
  joined_at: string;
};

export type RoomMessage = {
  message_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

export type SendMessageResult =
  | { success: true }
  | { success: false; message: string };

export type MembershipActionResult = SendMessageResult;
