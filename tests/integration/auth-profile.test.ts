import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { anonClient, createSignedInUser, deleteUser, type TestUser } from "./env";

const created: TestUser[] = [];
afterAll(async () => {
  await Promise.all(created.map((u) => deleteUser(u.id)));
});

describe("auth & profile", () => {
  it("requires email confirmation before password sign-in", async () => {
    const db = anonClient();
    const email = `unconfirmed-${randomUUID()}@test.local`;
    const signUp = await db.auth.signUp({ email, password: "testpass123" });
    expect(signUp.error).toBeNull();
    expect(signUp.data.session).toBeNull();

    const signIn = await db.auth.signInWithPassword({ email, password: "testpass123" });
    expect(signIn.error?.code).toBe("email_not_confirmed");
  });

  it("rejects weak passwords server-side", async () => {
    const { error } = await anonClient().auth.signUp({ email: `weak-${randomUUID()}@test.local`, password: "short" });
    expect(error).not.toBeNull();
  });

  it("creates a metric, not-onboarded profile on sign-up", async () => {
    const user = await createSignedInUser("profile");
    created.push(user);
    const { data, error } = await user.db.from("profiles").select("*").single();
    expect(error).toBeNull();
    expect(data).toMatchObject({ id: user.id, unit_system: "metric", onboarding_completed_at: null, estimate_sex: null });
  });

  it("saves preferences and estimate inputs, keeping skipped fields null", async () => {
    const user = await createSignedInUser("prefs");
    created.push(user);
    const { data, error } = await user.db
      .from("profiles")
      .update({ unit_system: "imperial", height_cm: 177.8, activity_level: "moderately_active", onboarding_completed_at: new Date().toISOString() })
      .eq("id", user.id)
      .select("*")
      .single();
    expect(error).toBeNull();
    expect(data).toMatchObject({ unit_system: "imperial", height_cm: 177.8, activity_level: "moderately_active", estimate_sex: null, birth_date: null });
  });

  it("upserts today's weigh-in idempotently with the default owner", async () => {
    const user = await createSignedInUser("weight");
    created.push(user);
    const day = "2026-10-27";
    for (const kg of [80.1, 80.4]) {
      const { error } = await user.db
        .from("weight_entries")
        .upsert({ measured_on: day, weight_kg: kg }, { onConflict: "user_id,measured_on" });
      expect(error).toBeNull();
    }
    const { data } = await user.db.from("weight_entries").select("user_id, weight_kg");
    expect(data).toEqual([{ user_id: user.id, weight_kg: 80.4 }]);
  });

  it("rejects invalid values at the API boundary", async () => {
    const user = await createSignedInUser("invalid");
    created.push(user);
    const negative = await user.db.from("weight_entries").insert({ measured_on: "2026-10-27", weight_kg: -5 });
    expect(negative.error?.code).toBe("23514");
    const badDate = await user.db.from("weight_entries").insert({ measured_on: "2026-02-30", weight_kg: 70 });
    expect(badDate.error).not.toBeNull();
    const futureBirth = await user.db.from("profiles").update({ birth_date: "2999-01-01" }).eq("id", user.id);
    expect(futureBirth.error?.code).toBe("23514");
  });

  it("deletes the account and all personal data via delete_my_account", async () => {
    const user = await createSignedInUser("delete");
    await user.db.from("weight_entries").insert({ measured_on: "2026-10-01", weight_kg: 70 });
    await user.db.from("routines").insert({ name: "To delete" });

    const { error } = await user.db.rpc("delete_my_account");
    expect(error).toBeNull();

    // The old session can no longer sign in or read anything.
    const signIn = await anonClient().auth.signInWithPassword({ email: user.email, password: user.password });
    expect(signIn.error).not.toBeNull();
    const { data: rows } = await user.db.from("weight_entries").select("id");
    expect(rows ?? []).toEqual([]);
  });

  it("rejects requests with an invalid or expired token", async () => {
    const db = anonClient();
    const { error } = await db.auth.getUser("not-a-real-jwt");
    expect(error).not.toBeNull();
  });
});
