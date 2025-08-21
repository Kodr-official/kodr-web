import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Header } from '@/components/layout/Header';
import { Send, Plus, Search, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { useSearchParams, useNavigate } from 'react-router-dom';

// Types
interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  sender_name: string;  
  sender_avatar?: string;
}

interface Conversation {
  id: string;
  other_user_id: string;
  other_user_name: string;
  other_user_avatar?: string;
  last_message?: string;
  last_message_at?: string;
}

const MOCK_USERS = [
  { id: 'user1', name: 'John Doe', avatar: 'https://i.pravatar.cc/150?img=1' },
  { id: 'user2', name: 'Jane Smith', avatar: 'https://i.pravatar.cc/150?img=2' },
  { id: 'user3', name: 'Alex Johnson', avatar: 'https://i.pravatar.cc/150?img=3' },
];

const Messages = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load and sort conversations from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('mock_conversations');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Sort by last_message_at in descending order (newest first)
      const sorted = [...parsed].sort((a, b) => 
        new Date(b.last_message_at || b.created_at).getTime() - 
        new Date(a.last_message_at || a.created_at).getTime()
      );
      setConversations(sorted);
    } else {
      setConversations([]);
    }
  }, []);

  // Load messages for selected conversation
  useEffect(() => {
    if (!selectedConversation) {
      setMessages([]);
      return;
    }

    const savedMessages = localStorage.getItem(`mock_messages_${selectedConversation}`);
    if (savedMessages) {
      setMessages(JSON.parse(savedMessages));
    } else {
      // Initialize with a welcome message
      const conversation = conversations.find(c => c.id === selectedConversation);
      if (conversation) {
        const welcomeMessage = {
          id: 'welcome',
          content: `You started a conversation with ${conversation.other_user_name}`,
          sender_id: 'system',
          sender_name: 'System',
          created_at: new Date().toISOString(),
        };
        setMessages([welcomeMessage]);
        localStorage.setItem(`mock_messages_${selectedConversation}`, JSON.stringify([welcomeMessage]));
      }
    }
  }, [selectedConversation, conversations]);

  // Auto-scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversation || !user) return;

    const message: Message = {
      id: `msg_${Date.now()}`,
      content: newMessage,
      sender_id: user.id,
      sender_name: user.user_metadata?.full_name || 'You',
      created_at: new Date().toISOString(),
    };

    // Update messages
    const updatedMessages = [...messages, message];
    setMessages(updatedMessages);
    localStorage.setItem(`mock_messages_${selectedConversation}`, JSON.stringify(updatedMessages));

    // Update conversation's last message
    const updatedConversations = conversations.map(conv => 
      conv.id === selectedConversation ? {
        ...conv,
        last_message: newMessage,
        last_message_at: new Date().toISOString(),
      } : conv
    );
    // Save to localStorage and sort by latest message
    const sortedConversations = [...updatedConversations].sort((a, b) => 
      new Date(b.last_message_at || b.created_at).getTime() - 
      new Date(a.last_message_at || a.created_at).getTime()
    );
    setConversations(sortedConversations);
    localStorage.setItem('mock_conversations', JSON.stringify(sortedConversations));

    setNewMessage('');
  };

  const startNewChat = async (userId: string) => {
    try {
      const existing = conversations.find(c => c.other_user_id === userId);
      if (existing) {
        navigate(`/messages?conversation=${existing.id}`);
        return;
      }
      const user = MOCK_USERS.find(u => u.id === userId);
      if (!user) {
        console.error('User not found');
        return;
      }
      const newConv = {
        id: `conv_${Date.now()}`,
        other_user_id: userId,
        other_user_name: user.name,
        other_user_avatar: user.avatar,
        last_message: 'Conversation started',
        last_message_at: new Date().toISOString(),
      };
      
      const updatedConvs = [...conversations, newConv];
      // Save to localStorage and sort by latest message
      const sortedConvs = [...updatedConvs].sort((a, b) => 
        new Date(b.last_message_at || b.created_at).getTime() - 
        new Date(a.last_message_at || a.created_at).getTime()
      );
      setConversations(sortedConvs);
      localStorage.setItem('mock_conversations', JSON.stringify(sortedConvs));
      navigate(`/messages?conversation=${newConv.id}`);
    } catch (error) {
      console.error('Error starting chat:', error);
      // You might want to show a toast notification here
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <p className="text-foreground">Please log in to view messages.</p>
          </div>
        </div>
      </div>
    );
  }

  const currentConversation = conversations.find(c => c.id === selectedConversation);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-180px)]">
          {/* Conversations List */}
          <Card className={`lg:col-span-1 ${selectedConversation ? 'hidden lg:block' : 'block'}`}>
            <CardHeader className="border-b p-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold">Messages</CardTitle>
                <Button size="sm" variant="outline" className="hidden lg:flex">
                  <Plus className="w-4 h-4 mr-2" />
                  New Chat
                </Button>
              </div>
              <div className="mt-2 relative">
                <input
                  type="text"
                  placeholder="Search conversations..."
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-y-auto h-[calc(100%-80px)]">
              {conversations.map(conv => (
                <div
                  key={conv.id}
                  className={`p-4 border-b cursor-pointer hover:bg-muted/50 ${
                    selectedConversation === conv.id ? 'bg-muted' : ''
                  }`}
                  onClick={() => {
                    setSelectedConversation(conv.id);
                    navigate(`/messages?conversation=${conv.id}`);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>
                        {conv.other_user_name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground">{conv.other_user_name}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {conv.last_message}
                      </p>
                    </div>
                    {conv.last_message_at && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(conv.last_message_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Chat Area */}
          {selectedConversation ? (
            <div className="lg:col-span-3 flex flex-col border rounded-lg overflow-hidden">
              {currentConversation && (
                <div className="border-b p-4 flex items-center gap-3 bg-card">
                  <Avatar>
                    <AvatarFallback>
                      {currentConversation.other_user_name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-medium">{currentConversation.other_user_name}</h3>
                    <p className="text-sm text-muted-foreground">Online</p>
                  </div>
                </div>
              )}

              <div className="flex-1 p-4 overflow-y-auto">
                {messages.map(message => (
                  <div
                    key={message.id}
                    className={`mb-4 flex ${
                      message.sender_id === user.id ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[80%] p-3 rounded-lg ${
                        message.sender_id === user.id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                      <p className="text-xs mt-1 opacity-70 text-right">
                        {new Date(message.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={handleSendMessage} className="border-t p-4">
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    className="flex-1"
                  />
                  <Button type="submit" size="icon">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            </div>
          ) : (
            <div className="lg:col-span-3 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">Select a conversation</h3>
                <p className="text-foreground/80 mt-1">
                  Or start a new chat with:
                </p>
                <div className="mt-4 flex flex-wrap gap-2 justify-center">
                  {MOCK_USERS.map(user => (
                    <Button
                      key={user.id}
                      variant="outline"
                      onClick={() => startNewChat(user.id)}
                    >
                      {user.name}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Messages;