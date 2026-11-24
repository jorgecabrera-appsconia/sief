import { describe, expect, it } from "vitest";
import { queryClient } from "./queryClient";

describe("queryClient freshness policy", () => {
  it("refreshes server data when a screen mounts or regains focus", () => {
    const queries = queryClient.getDefaultOptions().queries;

    expect(queries?.staleTime).toBe(0);
    expect(queries?.refetchOnMount).toBe("always");
    expect(queries?.refetchOnWindowFocus).toBe(true);
  });
});
