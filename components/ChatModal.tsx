import React, { useState, useEffect, useRef } from "react";
import { useApp } from "../AppContext";
import { Modal, Input, Button } from "./UI";
import { Icons } from "../constants";
import { User, StoreProfile } from "../types";

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  otherParty: User | StoreProfile;
}

export const ChatModal: React.FC<ChatModalProps> = ({
  isOpen,
  onClose,
  orderId,
  otherParty,
}) => {
  const { currentUser, messages, fetchMessages, sendMessage, joinChatRoom } =
    useApp();
  const [text, setText] = useState("");
  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && orderId) {
      fetchMessages(orderId);
      joinChatRoom(orderId);
    }
  }, [isOpen, orderId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (text.trim() && currentUser) {
      sendMessage({
        orderId,
        senderId: currentUser.id,
        receiverId: otherParty.id,
        text: text.trim(),
      });
      setText("");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Chat con ${otherParty.firstName}`}
    >
      <div className="flex flex-col h-[60vh]">
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 rounded-lg">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.senderId === currentUser?.id
                  ? "justify-end"
                  : "justify-start"
              }`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl shadow-sm ${
                  msg.senderId === currentUser?.id
                    ? "bg-primary text-white rounded-br-none"
                    : "bg-white text-gray-800 rounded-bl-none border"
                }`}
              >
                <p className="text-sm">{msg.text}</p>
                <p className="text-[10px] text-right mt-1 opacity-70">
                  {new Date(msg.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <div className="mt-4 flex gap-2">
          <Input
            value={text}
            onChange={(e: any) => setText(e.target.value)}
            placeholder="Escribe un mensaje..."
            onKeyPress={(e: any) => e.key === "Enter" && handleSend()}
            className="flex-1"
          />
          <Button onClick={handleSend} className="p-3">
            <Icons.Mail size={20} />
          </Button>
        </div>
      </div>
    </Modal>
  );
};
