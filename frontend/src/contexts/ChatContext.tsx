import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { Message } from "../types";
import { api } from "../api";

interface ChatContextType {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  unreadCounts: Record<string, number>;
  setUnreadCounts: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  fetchMessages: (orderId: string) => Promise<void>;
  markOrderMessagesAsRead: (orderId: string) => void;
}

const ChatContext = createContext<ChatContextType>({} as ChatContextType);

export const ChatProvider = ({ children }: { children: ReactNode }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  const fetchMessages = useCallback(async (orderId: string) => {
    if (!orderId) return;
    try {
      const res = await api.get(`/api/messages/${orderId}`);
      setMessages(res.data || []);
    } catch (e) {
      console.error("Error fetching messages:", e);
    }
  }, []);

  const markOrderMessagesAsRead = (id: string) => {
    setUnreadCounts((prev) => {
      const newCounts = { ...prev };
      delete newCounts[id];
      return newCounts;
    });
    api.put(`/api/messages/read/${id}`).catch(console.error);
  };

  return (
    <ChatContext.Provider
      value={{
        messages,
        setMessages,
        unreadCounts,
        setUnreadCounts,
        fetchMessages,
        markOrderMessagesAsRead,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => useContext(ChatContext);
