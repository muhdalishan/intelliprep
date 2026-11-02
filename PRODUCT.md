# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Pakistani university students (undergraduate and postgraduate) preparing for midterms and finals.
They study from their own material: lecture PDFs, slide decks, handwritten notes, recorded lectures
and past papers. Typical situation: the weeks before an exam, often late at night, juggling several
courses at once, with no reliable way to tell which topics matter most or whether they will remember
what they have read. UCP students are the first users.

## Product Purpose

IntelliPrep AI turns a student's own course material into active study: summaries, flashcards
scheduled before they would forget, quizzes that record weak topics, adaptive mock exams, and
predictions of likely exam topics drawn from past papers. Success is a student walking into an
exam having practised what is most likely to be asked, from their own notes.

## Positioning

Every answer comes from the student's own uploaded material, with citations back to the page or
slide. Exam-topic predictions are built from the student's actual past papers, reflecting the past-paper
culture of Pakistani universities, not from general knowledge about a subject.

## Operating Context

- Organised by subject (course), each with its own documents, decks, quizzes, plan and reminders.
- Past papers by year are a central study ritual; midterm and final exams set the calendar.
- Reminders reach students on Telegram (WhatsApp later).
- Study groups share notes inside a group and ask questions across members' notes.

## Capabilities and Constraints

- Web app; English-only interface.
- AI tutor is a personal study companion: the student can talk to it (voice) or type, and it replies
  like a teacher, grounded in their notes. It can also act for the student: set reminders, add notes,
  create study tasks. (Confirmed 2026-11-02; needs new backlog items.)
- All AI calls go through the backend; no provider keys in the browser.
- Spaced repetition uses SM-2 (Again / Hard / Good / Easy).
- Undecided: pricing, whether study groups ship in this release (PO decision).

## Brand Commitments

- Name: **IntelliPrep AI**.
- Final Year Project of the University of Central Punjab, group S26-CS-037.

## Evidence on Hand

- No real usage numbers, testimonials, ratings or university partnerships exist. Do not invent any.
- Phase 1 survey (30 UCP students): 87% spend 3+ hours re-reading notes without confidence in
  retention; 73% have no systematic way to identify likely exam topics; 91% want quizzes generated
  from their own notes. Source: `docs/phase-1-srs/IntelliPrep-AI-Phase1-SRS.pdf`.

## Product Principles

1. Grounded or silent: if it isn't in the student's notes, say so instead of guessing.
2. Show the source: every generated answer, summary and prediction points back to where it came from.
3. Tell the student what to do next: the most useful screen answers "what should I study now?"
4. Honest numbers only: progress, streaks and predictions come from real data, never decoration.
5. The student's notes are private by default; sharing is always an explicit choice.
