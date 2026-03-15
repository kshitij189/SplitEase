import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import '../styles/splitbot_modal.css';

const SplitBotModal = ({ groupId, onClose }) => {
  const [messages, setMessages] = useState([
    { id: 1, type: 'bot', text: "👋 Hi! I'm SplitBot. I can help you analyze group spending or tell you who owes what. Ask me anything!" }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);
  const chatAreaRef = useRef(null);

  const scrollToBottom = () => {
    if (chatAreaRef.current) {
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    // Focus input without jumping/scrolling the page
    if (inputRef.current) {
      inputRef.current.focus({ preventScroll: true });
    }
  }, []);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || isTyping) return;

    const userMsg = { id: Date.now(), type: 'user', text: inputText };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    try {
      const res = await axios.post(`/groups/${groupId}/ai-chat`, { message: inputText });
      setMessages(prev => [...prev, { id: Date.now() + 1, type: 'bot', text: res.data.reply }]);
    } catch (err) {
      console.error('AI Chat Error:', err);
      setMessages(prev => [...prev, { 
        id: Date.now() + 1, 
        type: 'bot', 
        text: "🤖 Oops! I couldn't connect to my brain. Please try again in a moment." 
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="splitbot-overlay" onClick={onClose}>
      <div className="splitbot-modal" onClick={e => e.stopPropagation()}>
        <div className="splitbot-header">
          <div className="splitbot-header-left">
            <div className="splitbot-logo-circle">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a10 10 0 0 1 10 10 10 10 0 0 1-10 10 10 10 0 0 1-10-10 10 10 0 0 1 10-10z"></path>
                <path d="M12 8v4"></path>
                <path d="M12 16h.01"></path>
              </svg>
            </div>
            <h2>Ask SplitBot</h2>
          </div>
          <button className="btn-close-modal" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="splitbot-chat-area" ref={chatAreaRef}>
          {messages.map(msg => (
            <div key={msg.id} className={`chat-message ${msg.type}`}>
              {msg.text}
            </div>
          ))}
          {isTyping && <div className="bot-typing">SplitBot is thinking...</div>}
        </div>

        <div className="splitbot-input-area">
          <form className="splitbot-form" onSubmit={handleSendMessage}>
            <input
              type="text"
              placeholder="How much did we spend on food?"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              disabled={isTyping}
              ref={inputRef}
            />
            <button type="submit" className="btn-send-chat" disabled={!inputText.trim() || isTyping}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SplitBotModal;
