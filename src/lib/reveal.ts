import type { Who } from '@/data/types';
import { save, useKind, type Entity } from '@/lib/db';
import { useSettings } from '@/lib/settings';

// Votos y respuestas con revelado simultáneo (F17, F43, F44).
// El servidor no devuelve la elección del otro hasta que respondes tú o pasa la medianoche del día siguiente.

export interface VoteEntity extends Entity { kind: 'vote'; topic: string; choice: string | null }
export interface AnswerEntity extends Entity { kind: 'answer'; questionId: string; text: string | null }

export interface RevealState<T> { mine?: T; theirs?: T; other: Who; revealed: boolean }

export function useVote(topic: string): RevealState<VoteEntity> & { vote: (choice: string) => Promise<Entity> } {
  const me = useSettings().profile ?? 'jesus';
  const other: Who = me === 'jesus' ? 'lucia' : 'jesus';
  const all = (useKind<VoteEntity>('vote') ?? []).filter((v) => v.topic === topic);
  const mine = all.find((v) => v.author === me);
  const theirs = all.find((v) => v.author === other);
  return {
    mine, theirs, other,
    revealed: Boolean(theirs && !theirs.locked && theirs.choice !== null),
    vote: (choice) => save({ id: `vote:${topic}:${me}`, kind: 'vote', topic, choice, author: me }),
  };
}

export function useAnswer(questionId: string): RevealState<AnswerEntity> & { answer: (text: string) => Promise<Entity> } {
  const me = useSettings().profile ?? 'jesus';
  const other: Who = me === 'jesus' ? 'lucia' : 'jesus';
  const all = (useKind<AnswerEntity>('answer') ?? []).filter((a) => a.questionId === questionId);
  const mine = all.find((a) => a.author === me);
  const theirs = all.find((a) => a.author === other);
  return {
    mine, theirs, other,
    revealed: Boolean(theirs && !theirs.locked && theirs.text !== null),
    answer: (text) => save({ id: `answer:${questionId}:${me}`, kind: 'answer', questionId, text, author: me }),
  };
}
