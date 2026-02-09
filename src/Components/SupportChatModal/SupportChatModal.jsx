import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./SupportChatModal.module.css";

const SESSION_KEY = "support_session_id";

const getSessionId = () => {
  if (typeof window === "undefined") return "session";
  const stored = window.localStorage.getItem(SESSION_KEY);
  if (stored) return stored;

  let id = "";
  if (window.crypto?.randomUUID) {
    id = window.crypto.randomUUID();
  } else {
    id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  window.localStorage.setItem(SESSION_KEY, id);
  return id;
};

const getWsUrl = (sessionId) => {
  if (typeof window === "undefined") return "";
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}/ws/support/${sessionId}/`;
};

const STATUS_LABEL = {
  connecting: "подключение",
  online: "онлайн",
  offline: "офлайн",
};

export default function SupportChatModal({
  isOpen,
  onClose,
  triggerRef,
  userName,
}) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [status, setStatus] = useState("connecting");

  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
  const shouldReconnectRef = useRef(false);
  const awaitingSupportRef = useRef(false);

  const listRef = useRef(null);
  const inputRef = useRef(null);
  const previouslyFocusedRef = useRef(null);

  const sessionId = useMemo(getSessionId, []);

  const closeWithCleanup = () => {
    onClose?.();
  };

  const clearReconnectTimer = () => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  };

  const closeSocket = () => {
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  const isNearBottom = () => {
    const node = listRef.current;
    if (!node) return true;
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
    return distance < 80;
  };

  const scrollToBottom = () => {
    const node = listRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  };

  const scheduleReconnect = () => {
    clearReconnectTimer();
    const delays = [1000, 2000, 5000, 10000];
    const attempt = reconnectAttemptRef.current;
    const delay = delays[Math.min(attempt, delays.length - 1)];
    reconnectAttemptRef.current += 1;

    reconnectTimerRef.current = setTimeout(() => {
      if (shouldReconnectRef.current) {
        connect();
      }
    }, delay);
  };

  const handleIncomingMessage = (payload) => {
    const shouldScroll = isNearBottom();
    setMessages((prev) => [...prev, payload]);
    requestAnimationFrame(() => {
      if (shouldScroll) scrollToBottom();
    });
  };

  const connect = () => {
    if (!shouldReconnectRef.current) return;
    const url = getWsUrl(sessionId);
    if (!url) return;

    setStatus("connecting");
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("online");
      reconnectAttemptRef.current = 0;
    };

    ws.onmessage = (event) => {
      if (!event?.data) return;
      let parsed = null;
      try {
        parsed = JSON.parse(event.data);
      } catch (err) {
        return;
      }

      // ✅ ОБРАБОТКА ИСТОРИИ
      if (parsed?.type === "history") {
        const historyMessages = Array.isArray(parsed?.messages) ? parsed.messages : [];

        const formatted = historyMessages
          .filter(msg => msg?.text && !msg.text.startsWith("[WEB]")) // фильтруем [WEB] сообщения
          .map(msg => ({
            id: `history-${msg.timestamp || Date.now()}-${Math.random()}`,
            type: "message",
            from: msg.sender === "support" ? "support" : "user",
            text: msg.text,
          }));

        setMessages(formatted);

        // Прокрутка вниз после загрузки истории
        requestAnimationFrame(() => {
          scrollToBottom();
        });
        return;
      }

      if (parsed?.type === "system") {
        awaitingSupportRef.current = false;
        handleIncomingMessage({
          id: `${Date.now()}-${Math.random()}`,
          type: "system",
          text: String(parsed?.text ?? ""),
        });
        return;
      }

      if (parsed?.type === "message") {
        const text = String(parsed?.text ?? "");

        if (text.startsWith("[WEB]")) {
          return;
        }

        handleIncomingMessage({
          id: `${Date.now()}-${Math.random()}`,
          type: "message",
          from: "support",
          text,
        });
      }
    };

    ws.onerror = () => {
      setStatus("offline");
    };

    ws.onclose = () => {
      setStatus("offline");
      if (shouldReconnectRef.current) {
        scheduleReconnect();
      }
    };
  };

  useEffect(() => {
    if (!isOpen) return undefined;

    shouldReconnectRef.current = true;
    previouslyFocusedRef.current = document.activeElement;

    const onKey = (event) => {
      if (event.key === "Escape") closeWithCleanup();
    };

    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    connect();

    requestAnimationFrame(() => {
      inputRef.current?.focus();
      scrollToBottom();
    });

    return () => {
      shouldReconnectRef.current = false;
      clearReconnectTimer();
      closeSocket();
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;

      const focusTarget = triggerRef?.current || previouslyFocusedRef.current;
      focusTarget?.focus?.();
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) return;
    setMessages([]);
    setInputValue("");
    setStatus("connecting");
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOverlayClick = (event) => {
    if (event.target === event.currentTarget) {
      closeWithCleanup();
    }
  };

  const handleSend = () => {
    const text = inputValue.trim();
    if (!text) return;

    const outbound = {
      type: "message",
      text,
      user_name: userName || "Пользователь",
    };

    const shouldScroll = isNearBottom();
    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        type: "message",
        from: "user",
        text,
      },
    ]);

    requestAnimationFrame(() => {
      if (shouldScroll) scrollToBottom();
    });

    setInputValue("");
    awaitingSupportRef.current = true;

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(outbound));
    }
  };

  const onInputKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const triggerLabel = STATUS_LABEL[status] || STATUS_LABEL.offline;
  const userLetter = (userName || "П").charAt(0).toUpperCase();

  return createPortal(
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="support-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className={styles.close}
          onClick={closeWithCleanup}
          aria-label="Закрыть"
        >
          ×
        </button>

        <div className={styles.title} id="support-title">
          Поддержка
        </div>

        <div className={styles.chatBox}>
          <div className={styles.chatHeader}>
            <div className={styles.headerAvatar}>
              <span className={styles.headerAvatarLetter}>S</span>
            </div>
            <div className={styles.headerText}>
              <div className={styles.headerTitle}>Служба поддержки</div>
              <div className={styles.headerSubtitle}>мы секси бегемоты</div>
            </div>
            <div className={styles.status}>{triggerLabel}</div>
          </div>

          <div className={styles.messages} ref={listRef}>
            {messages.map((msg) => {
              if (msg.type === "system") {
                return (
                  <div key={msg.id} className={styles.systemMessage}>
                    {msg.text}
                  </div>
                );
              }

              const rowClass =
                msg.from === "user" ? styles.messageRowRight : styles.messageRowLeft;
              const bubbleClass =
                msg.from === "user" ? styles.bubbleUser : styles.bubbleSupport;
              const avatarClass =
                msg.from === "user" ? styles.avatarUser : styles.avatarSupport;
              const letter = msg.from === "user" ? userLetter : "K";

              return (
                <div key={msg.id} className={`${styles.messageRow} ${rowClass}`}>
                  <div className={`${styles.avatar} ${avatarClass}`}>
                    <span className={styles.avatarLetter}>{letter}</span>
                  </div>
                  <div className={`${styles.bubble} ${bubbleClass}`}>{msg.text}</div>
                </div>
              );
            })}
          </div>

          <div className={styles.inputBar}>
            <div className={styles.inputWrap}>
              <textarea
                ref={inputRef}
                className={styles.input}
                placeholder="Напишите сообщение"
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={onInputKeyDown}
                rows={1}
              />
            </div>
            <button
              type="button"
              className={styles.sendButton}
              onClick={handleSend}
              disabled={!inputValue.trim()}
              aria-label="Отправить"
            >
              ➤
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
