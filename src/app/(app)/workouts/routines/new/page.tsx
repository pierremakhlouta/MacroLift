"use client";

import { BackLink } from "@/components/back-link";
import { useState } from "react";
import { RoutineEditor } from "@/components/routines/routine-editor";
import { PageHeader } from "@/components/ui";
import type { Routine } from "@/lib/queries/routines";

export default function NewRoutinePage() {
  // The id is generated on first save (see RoutineEditor) so retries reuse it.
  const [routine] = useState<Routine>(() => ({
    id: "",
    user_id: "",
    name: "",
    notes: null,
    archived_at: null,
    created_at: "",
    updated_at: "",
    items: [],
  }));

  return (
    <>
      <BackLink href="/workouts" label="Workouts" />
      <PageHeader title="New routine" />
      <RoutineEditor routine={routine} isNew />
    </>
  );
}
