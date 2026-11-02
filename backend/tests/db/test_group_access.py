"""Who can see and change what, checked against the real migrations and policies."""

import psycopg
import pytest


def make_subject(db, owner, name="Data Structures"):
    with db.as_user(owner) as c:
        return c.execute(
            "insert into subjects (name) values (%s) returning id", (name,)
        ).fetchone()["id"]


def make_group(db, lead, name="DS Midterm Crew"):
    with db.as_user(lead) as c:
        return c.execute(
            "insert into study_groups (name) values (%s) returning id, invite_code", (name,)
        ).fetchone()


def join(db, user, code):
    with db.as_user(user) as c:
        return c.execute("select join_group(%s) as id", (code,)).fetchone()["id"]


def share(db, user, group_id, subject_id):
    with db.as_user(user) as c:
        c.execute(
            "insert into group_subjects (group_id, subject_id) values (%s, %s)",
            (group_id, subject_id),
        )


def visible(db, user, sql, params=()):
    with db.as_user(user) as c:
        return c.execute(sql, params).fetchall()


@pytest.fixture
def trio(db):
    """Alice leads a group, Bob joins it, Carol is outside it."""
    alice, bob, carol = db.new_user("Alice"), db.new_user("Bob"), db.new_user("Carol")
    group = make_group(db, alice)
    join(db, bob, group["invite_code"])
    return alice, bob, carol, group


def test_subjects_are_private_until_shared(db, trio) -> None:
    alice, bob, _, group = trio
    subject = make_subject(db, alice)
    assert visible(db, bob, "select id from subjects where id = %s", (subject,)) == []

    share(db, alice, group["id"], subject)
    assert len(visible(db, bob, "select id from subjects where id = %s", (subject,))) == 1


def test_creator_is_lead_and_joining_uses_the_invite_code(db) -> None:
    alice, bob = db.new_user("Alice"), db.new_user("Bob")
    group = make_group(db, alice)
    assert visible(db, bob, "select id from study_groups where id = %s", (group["id"],)) == []

    assert join(db, bob, f"  {group['invite_code'].lower()} ") == group["id"]
    members = visible(db, bob, "select * from group_member_list(%s)", (group["id"],))
    assert [(m["full_name"], m["role"]) for m in members] == [("Alice", "lead"), ("Bob", "member")]
    assert "email" not in members[0]


def test_wrong_invite_code_is_rejected(db) -> None:
    bob = db.new_user("Bob")
    with pytest.raises(psycopg.errors.NoDataFound, match="invite code"):
        join(db, bob, "NOPE1234")


def test_one_group_can_hold_many_subjects_and_one_subject_many_groups(db, trio) -> None:
    alice, bob, _, group = trio
    ds, calc = make_subject(db, alice, "Data Structures"), make_subject(db, alice, "Calculus II")
    share(db, alice, group["id"], ds)
    share(db, alice, group["id"], calc)
    other = make_group(db, alice, "Calc only")
    share(db, alice, other["id"], calc)

    names = visible(db, bob, "select name from subjects order by name")
    assert [n["name"] for n in names] == ["Calculus II", "Data Structures"]
    assert (
        len(visible(db, alice, "select * from group_subjects where subject_id = %s", (calc,))) == 2
    )


def test_members_cannot_share_someone_elses_subject(db, trio) -> None:
    alice, bob, _, group = trio
    subject = make_subject(db, alice)
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        share(db, bob, group["id"], subject)


def test_outsiders_see_nothing_of_the_group(db, trio) -> None:
    alice, _, carol, group = trio
    subject = make_subject(db, alice)
    share(db, alice, group["id"], subject)
    assert visible(db, carol, "select id from study_groups") == []
    assert visible(db, carol, "select * from group_subjects") == []
    assert visible(db, carol, "select id from subjects where id = %s", (subject,)) == []
    assert visible(db, carol, "select * from group_member_list(%s)", (group["id"],)) == []


def test_shared_planner_and_board_are_edited_together(db, trio) -> None:
    alice, bob, carol, group = trio
    subject = make_subject(db, alice)
    share(db, alice, group["id"], subject)

    with db.as_user(bob) as c:
        task = c.execute(
            "insert into subject_tasks (subject_id, title) values (%s, 'AVL rotations') returning id",
            (subject,),
        ).fetchone()["id"]
        c.execute(
            "insert into board_notes (subject_id, content) values (%s, 'Heaps are trees')",
            (subject,),
        )
    with db.as_user(alice) as c:
        c.execute("update subject_tasks set status = 'learning' where id = %s", (task,))

    assert visible(db, bob, "select status from subject_tasks where id = %s", (task,)) == [
        {"status": "learning"}
    ]
    assert (
        len(visible(db, alice, "select id from board_notes where subject_id = %s", (subject,))) == 1
    )
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        with db.as_user(carol) as c:
            c.execute("insert into subject_tasks (subject_id, title) values (%s, 'x')", (subject,))


def test_documents_of_shared_subjects_are_readable_flashcards_stay_personal(db, trio) -> None:
    alice, bob, _, group = trio
    subject = make_subject(db, alice)
    with db.as_user(alice) as c:
        c.execute(
            "insert into documents (subject_id, filename, storage_path, format) "
            "values (%s, 'L6.pdf', %s, 'pdf')",
            (subject, f"{alice}/L6.pdf"),
        )
        c.execute(
            "insert into flashcards (subject_id, term, definition) values (%s, 'AVL', 'balanced')",
            (subject,),
        )
    share(db, alice, group["id"], subject)

    assert len(visible(db, bob, "select id from documents where subject_id = %s", (subject,))) == 1
    assert visible(db, bob, "select id from flashcards where subject_id = %s", (subject,)) == []


def test_chat_is_members_only(db, trio) -> None:
    alice, bob, carol, group = trio
    with db.as_user(bob) as c:
        c.execute(
            "insert into group_messages (group_id, body) values (%s, 'Ready for DS?')",
            (group["id"],),
        )
    assert [m["body"] for m in visible(db, alice, "select body from group_messages")] == [
        "Ready for DS?"
    ]
    assert visible(db, carol, "select body from group_messages") == []
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        with db.as_user(carol) as c:
            c.execute(
                "insert into group_messages (group_id, body) values (%s, 'hi')", (group["id"],)
            )


def test_unsharing_removes_access(db, trio) -> None:
    alice, bob, _, group = trio
    subject = make_subject(db, alice)
    share(db, alice, group["id"], subject)
    with db.as_user(alice) as c:
        c.execute("delete from group_subjects where subject_id = %s", (subject,))
    assert visible(db, bob, "select id from subjects where id = %s", (subject,)) == []


def test_lead_leaving_hands_over_and_last_member_closes_group(db, trio) -> None:
    alice, bob, _, group = trio
    with db.as_user(alice) as c:
        c.execute("select leave_group(%s)", (group["id"],))
    members = visible(db, bob, "select * from group_member_list(%s)", (group["id"],))
    assert [(m["full_name"], m["role"]) for m in members] == [("Bob", "lead")]

    with db.as_user(bob) as c:
        c.execute("select leave_group(%s)", (group["id"],))
    assert (
        db.conn.execute("select id from study_groups where id = %s", (group["id"],)).fetchall()
        == []
    )


def test_only_leads_remove_members(db, trio) -> None:
    alice, bob, _, group = trio
    with db.as_user(bob) as c:
        removed = c.execute(
            "delete from group_members where group_id = %s and user_id = %s returning user_id",
            (group["id"], alice),
        ).fetchall()
    assert removed == []
    with db.as_user(alice) as c:
        removed = c.execute(
            "delete from group_members where group_id = %s and user_id = %s returning user_id",
            (group["id"], bob),
        ).fetchall()
    assert len(removed) == 1


def test_a_lead_who_leaves_no_longer_sees_the_group(db, trio) -> None:
    alice, _, _, group = trio
    with db.as_user(alice) as c:
        c.execute("select leave_group(%s)", (group["id"],))
    assert visible(db, alice, "select id from study_groups where id = %s", (group["id"],)) == []
