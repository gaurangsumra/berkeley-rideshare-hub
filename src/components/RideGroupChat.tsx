import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send } from "lucide-react";
import { format } from "date-fns";

interface Message {
  id: string;
  message: string;
  created_at: string;
  user_id: string;
  profiles: {
    name: string;
    photo: string | null;
  } | null;
}

interface RideGroupChatProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rideId: string;
  rideName: string;
}

export const RideGroupChat = ({ open, onOpenChange, rideId, rideName }: RideGroupChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (open) {
      fetchMessages();
      markAsRead();
      
      supabase.auth.getSession().then(({ data: { session } }) => {
        setCurrentUserId(session?.user?.id || null);
      });

      const channel = supabase
        .channel(`ride-chat-${rideId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'ride_group_messages',
            filter: `ride_id=eq.${rideId}`,
          },
          (payload) => {
            fetchMessages();
            scrollToBottom();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [open, rideId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('ride_group_messages')
      .select('id, message, created_at, user_id')
      .eq('ride_id', rideId)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) {
      return;
    }

    if (!data) return;

    // Fetch profile data for each unique user
    const userIds = [...new Set(data.map(m => m.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, photo')
      .in('id', userIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
    
    const messagesWithProfiles = data.map(msg => ({
      ...msg,
      profiles: profileMap.get(msg.user_id) || null,
    }));

    setMessages(messagesWithProfiles as Message[]);
  };

  const markAsRead = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await supabase
      .from('ride_message_reads')
      .upsert({
        user_id: session.user.id,
        ride_id: rideId,
        last_read_at: new Date().toISOString(),
      });
  };

  const handleSend = async () => {
    if (!newMessage.trim() || loading) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast({ title: "Please sign in to send messages", variant: "destructive" });
      return;
    }

    setLoading(true);
    const messageText = newMessage.trim();
    
    const { data: insertedMessage, error } = await supabase
      .from('ride_group_messages')
      .insert({
        ride_id: rideId,
        user_id: session.user.id,
        message: messageText,
      })
      .select()
      .single();

    if (error) {
      toast({ title: "Failed to send message", variant: "destructive" });
    } else {
      setNewMessage("");
      
      // Send email notifications to all members except sender
      try {
        const { data: members } = await supabase
          .from('ride_members')
          .select('user_id, profiles(email, name)')
          .eq('ride_id', rideId)
          .neq('user_id', session.user.id);

        if (members && members.length > 0) {
          const recipientEmails = members
            .map(m => m.profiles?.email)
            .filter(Boolean) as string[];

          if (recipientEmails.length > 0) {
            const { data: senderProfile } = await supabase
              .from('profiles')
              .select('name')
              .eq('id', session.user.id)
              .single();

            const { data, error: invokeError } = await supabase.functions.invoke('send-ride-notification', {
              body: {
                type: 'new_chat_message',
                rideId: rideId,
                recipientEmails: recipientEmails,
                actorName: senderProfile?.name || 'Someone',
                messagePreview: messageText.substring(0, 50) + (messageText.length > 50 ? '...' : ''),
                messageId: insertedMessage?.id,
              }
            });

            if (invokeError) {
              toast({
                title: "Message sent but notifications failed",
                description: "Your message was sent but email notifications couldn't be delivered.",
                variant: "destructive"
              });
            } else if (data) {
              if (data.failed > 0) {
                toast({
                  title: "Partial notification failure",
                  description: `${data.sent} notifications sent, ${data.failed} failed.`,
                  variant: "destructive"
                });
              }
            }
          }
        }
      } catch (emailError) {
        toast({
          title: "Notification error",
          description: "Your message was sent but we couldn't send email notifications.",
          variant: "destructive"
        });
      }
    }
    
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="p-6 pb-4 border-b">
          <SheetTitle>Ride Group Chat</SheetTitle>
          <p className="text-sm text-muted-foreground">{rideName}</p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No messages yet. Start the conversation!
            </div>
          ) : (
            messages.map((msg) => {
              const isCurrentUser = msg.user_id === currentUserId;
              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${isCurrentUser ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarImage src={msg.profiles?.photo || undefined} />
                    <AvatarFallback>
                      {msg.profiles?.name.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className={`flex flex-col ${isCurrentUser ? 'items-end' : 'items-start'} max-w-[75%]`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">{msg.profiles?.name || 'Unknown'}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(msg.created_at), 'h:mm a')}
                      </span>
                    </div>
                    <div
                      className={`rounded-lg px-4 py-2 ${
                        isCurrentUser
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t bg-background">
          <div className="flex gap-2">
            <Textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="resize-none"
              rows={2}
              maxLength={500}
            />
            <Button
              onClick={handleSend}
              disabled={!newMessage.trim() || loading}
              size="icon"
              className="self-end"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {newMessage.length}/500 characters
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
};
