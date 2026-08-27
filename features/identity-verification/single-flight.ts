export type SingleFlightLock = {
  current: "idle" | "pending" | "succeeded";
};

type SingleFlightOptions<T> = {
  retainWhen?: (result: T) => boolean;
};

export async function runSingleFlight<T>(
  lock: SingleFlightLock,
  operation: () => Promise<T>,
  options: SingleFlightOptions<T> = {}
): Promise<T | undefined> {
  if (lock.current !== "idle") {
    return undefined;
  }

  lock.current = "pending";
  try {
    const result = await operation();
    lock.current = options.retainWhen?.(result) ? "succeeded" : "idle";
    return result;
  } catch (error) {
    lock.current = "idle";
    throw error;
  }
}

export function resetCompletedSingleFlight(lock: SingleFlightLock): void {
  if (lock.current === "succeeded") {
    lock.current = "idle";
  }
}
