import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read: boolean;
  created_at: string;
  sender?: {
    username: string;
    avatar_url?: string;
  };
  receiver?: {
    username: string;
    avatar_url?: string;
  };
}

export function useMessages(userId: string | undefined) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchMessages = async () => {
    if (!userId) return;

    try {
      const { data, error } = await (supabase as any)
        .from('messages')
        .select(`
          *,
          sender:sender_id (username, avatar_url),
          receiver:receiver_id (username, avatar_url)
        `)
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMessages(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch messages",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (receiverId: string, content: string) => {
    if (!userId) return;

    try {
      const { error } = await (supabase as any)
        .from('messages')
        .insert({
          sender_id: userId,
          receiver_id: receiverId,
          content
        });

      if (error) throw error;
      
      toast({
        title: "Message sent",
        description: "Your message has been sent successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchMessages();

    if (!userId) return;

    // Set up realtime subscription
    const channel = supabase
      .channel('messages-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=eq.${userId},receiver_id=eq.${userId}`
        },
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return { messages, loading, sendMessage, refetch: fetchMessages };
}
