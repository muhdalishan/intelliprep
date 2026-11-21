-- Sticky notes on a subject's board can be resized by dragging their corner.
alter table public.board_notes
  add column width smallint not null default 176 check (width between 120 and 480),
  add column height smallint not null default 176 check (height between 120 and 480);
