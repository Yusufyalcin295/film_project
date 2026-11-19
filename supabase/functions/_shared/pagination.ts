
export interface UserAction {
  actor_id: string;
  target_id: string;
  action: string;
}

export interface ActionPage {
  data: UserAction[] | null;
  error: { message: string } | null;
}

export async function loadActionPages(
  fetchPage: (start: number, end: number) => Promise<ActionPage>,
  pageSize = 1000,
  maxPages = 50,
): Promise<UserAction[]> {
  const actions: UserAction[] = [];

  for (let page = 0; page < maxPages; page++) {
    const start = page * pageSize;
    const end = start + pageSize - 1;

    const { data, error } = await fetchPage(start, end);

    if (error) {
      throw new Error("Could not load user actions");
    }

    actions.push(...(data ?? []));

    if ((data?.length ?? 0) < pageSize) {
      return actions;
    }
  }

  throw new Error("Action dataset exceeds the current limit");
}
