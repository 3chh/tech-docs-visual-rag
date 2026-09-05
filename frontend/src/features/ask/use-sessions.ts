import { useCallback, useEffect, useState } from "react";

import { isMockMode, mockErrorTurn, mockTurns } from "@/lib/mock";
import type { AskTurn } from "@/lib/types";

export interface ChatSession {
  id: string;
  collection: string;
  title: string;
  updatedAt: number;
  turns: AskTurn[];
}

const STORAGE_KEY = "cosmo_chatpdf_sessions";

function loadStoredSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStoredSessions(sessions: ChatSession[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // ignore quota errors
  }
}

export function useChatSessions(collection: string) {
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const stored = loadStoredSessions();
    if (stored.length > 0) return stored;

    // Initial default session
    const initialSession: ChatSession = {
      id: "default-session",
      collection,
      title: isMockMode() ? "Tra cứu TCVN 2737:2023" : "Cuộc trò chuyện mới",
      updatedAt: Date.now(),
      turns: isMockMode() ? [...mockTurns, mockErrorTurn] : [],
    };
    return [initialSession];
  });

  const [currentSessionId, setCurrentSessionId] = useState<string>(() => {
    const matching = sessions.find((s) => s.collection === collection);
    return matching?.id ?? sessions[0]?.id ?? "default-session";
  });

  // Save changes to localStorage
  useEffect(() => {
    saveStoredSessions(sessions);
  }, [sessions]);

  // When collection changes, switch to the most recent session for that collection or create one
  useEffect(() => {
    const matching = sessions.filter((s) => s.collection === collection);
    if (matching.length > 0) {
      // Pick the most recent session in this collection
      const sorted = [...matching].sort((a, b) => b.updatedAt - a.updatedAt);
      setCurrentSessionId(sorted[0].id);
    } else {
      // Create a fresh session for this collection
      const newId = crypto.randomUUID();
      const newSession: ChatSession = {
        id: newId,
        collection,
        title: "Cuộc trò chuyện mới",
        updatedAt: Date.now(),
        turns: isMockMode() ? [...mockTurns, mockErrorTurn] : [],
      };
      setSessions((prev) => [newSession, ...prev]);
      setCurrentSessionId(newId);
    }
  }, [collection]);

  const currentSession = sessions.find((s) => s.id === currentSessionId);
  const currentTurns = currentSession?.turns ?? [];

  const updateCurrentTurns = useCallback(
    (updater: AskTurn[] | ((prev: AskTurn[]) => AskTurn[])) => {
      setSessions((prevSessions) =>
        prevSessions.map((s) => {
          if (s.id !== currentSessionId) return s;
          const nextTurns = typeof updater === "function" ? updater(s.turns) : updater;

          // Compute a nice title from the first question if currently default
          let title = s.title;
          if (nextTurns.length > 0 && (s.title === "Cuộc trò chuyện mới" || !s.title)) {
            const firstQ = nextTurns[0].question.trim();
            title = firstQ.length > 38 ? firstQ.slice(0, 38) + "..." : firstQ;
          }

          return {
            ...s,
            turns: nextTurns,
            title,
            updatedAt: Date.now(),
          };
        }),
      );
    },
    [currentSessionId],
  );

  const createNewSession = useCallback(() => {
    const newId = crypto.randomUUID();
    const newSession: ChatSession = {
      id: newId,
      collection,
      title: "Cuộc trò chuyện mới",
      updatedAt: Date.now(),
      turns: [],
    };
    setSessions((prev) => [newSession, ...prev]);
    setCurrentSessionId(newId);
    return newId;
  }, [collection]);

  const selectSession = useCallback((id: string) => {
    setCurrentSessionId(id);
  }, []);

  const deleteSession = useCallback(
    (id: string) => {
      setSessions((prev) => {
        const remaining = prev.filter((s) => s.id !== id);
        if (remaining.length === 0) {
          const fresh: ChatSession = {
            id: crypto.randomUUID(),
            collection,
            title: "Cuộc trò chuyện mới",
            updatedAt: Date.now(),
            turns: [],
          };
          setCurrentSessionId(fresh.id);
          return [fresh];
        }
        if (currentSessionId === id) {
          const matching = remaining.filter((s) => s.collection === collection);
          setCurrentSessionId(matching[0]?.id ?? remaining[0].id);
        }
        return remaining;
      });
    },
    [collection, currentSessionId],
  );

  return {
    sessions,
    currentSessionId,
    currentSession,
    currentTurns,
    updateCurrentTurns,
    createNewSession,
    selectSession,
    deleteSession,
  };
}
